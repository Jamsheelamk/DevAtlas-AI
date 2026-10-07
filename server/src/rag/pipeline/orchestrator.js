// server/src/rag/pipeline/orchestrator.js
import crypto from "node:crypto";
import { processInput } from "./01_inputProcessor.js";
import { classifyIntent } from "./02_intentClassifier.js";
import { enhanceQuery } from "./03_queryEnhancer.js";
import { retrieveChunks } from "./04_retriever.js";
import { rerankChunks } from "./05_reranker.js";
import { assembleContext } from "./06_contextAssembler.js";
import { generateResponse } from "./07_generator.js";
import { validateRetrievalAndResponse } from "./08_validator.js";
import { buildCitations } from "./09_citationBuilder.js";
import { getCache, setCache } from "../../services/cache.js";

function hashQuery(str) {
  return crypto.createHash("sha256").update(str.trim().toLowerCase()).digest("hex");
}

export async function executeRAGPipeline({
  query,
  history = [],
  userFilter = null,
  model = null,
  apiKey = null,
  onTelemetry = () => {},
  stream = false,
}) {
  const overallStart = Date.now();
  const telemetry = [];

  const recordStage = (stageNum, name, data) => {
    const item = { stage: stageNum, name, timestamp: Date.now(), ...data };
    telemetry.push(item);
    onTelemetry(item);
  };

  // Stage 1: Input Processing
  const inputRes = processInput({ query, history });
  recordStage(1, "Input Processing", {
    cleanedQuery: inputRes.cleanedQuery,
    language: inputRes.language,
    wordCount: inputRes.wordCount,
    latencyMs: inputRes.latencyMs,
  });

  // Check cache for identical queries
  const queryHash = hashQuery(inputRes.cleanedQuery);
  const cachedResponse = await getCache(`query:${queryHash}`);
  if (cachedResponse && !stream) {
    recordStage(10, "Cache Hit", { cached: true });
    return {
      answer: cachedResponse.answer,
      citations: cachedResponse.citations,
      telemetry,
      cached: true,
      totalLatencyMs: Date.now() - overallStart,
    };
  }

  // Stage 2: Intent Classification
  const intentRes = await classifyIntent({
    cleanedQuery: inputRes.cleanedQuery,
    history: inputRes.history,
    apiKey,
  });
  recordStage(2, "Intent Classification", {
    intent: intentRes.intent,
    confidence: intentRes.confidence,
    latencyMs: intentRes.latencyMs,
  });

  // Short circuit if out of scope
  if (intentRes.intent === "out_of_scope") {
    const citationsRes = { citations: [] };
    recordStage(9, "Source / Citation Generation", { count: 0 });
    recordStage(10, "Final Response", { totalLatencyMs: Date.now() - overallStart });
    return {
      answer: intentRes.redirectMessage,
      citations: [],
      telemetry,
      totalLatencyMs: Date.now() - overallStart,
    };
  }

  // Stage 3: Query Enhancement
  let enhanceRes = enhanceQuery({
    cleanedQuery: inputRes.cleanedQuery,
    history: inputRes.history,
    userFilter,
  });
  recordStage(3, "Query Understanding / Rewriting", {
    enhancedQuery: enhanceRes.enhancedQuery,
    detectedLibraries: enhanceRes.detectedLibraries,
    keywords: enhanceRes.keywords,
    latencyMs: enhanceRes.latencyMs,
  });

  // Stage 4 & 5: Retrieval & Re-ranking (with Stage 8 retry loop)
  let retryCount = 0;
  let rerankRes = null;
  let validationRes = null;
  let retrievalRes = null;

  while (retryCount <= 1) {
    // Stage 4: Retrieval
    retrievalRes = await retrieveChunks({
      enhancedQuery: enhanceRes.enhancedQuery,
      detectedLibraries: enhanceRes.detectedLibraries,
      topK: 8,
    });
    recordStage(4, `RAG Retrieval ${retryCount > 0 ? "(Retry Pass)" : ""}`, {
      candidateCount: retrievalRes.candidateCount,
      latencyMs: retrievalRes.latencyMs,
      retryCount,
    });

    // Stage 5: Re-ranking
    rerankRes = rerankChunks({
      candidates: retrievalRes.candidates,
      keywords: enhanceRes.keywords,
      topK: 4,
    });
    recordStage(5, "Re-Ranking & Deduplication", {
      selectedCount: rerankRes.rerankedChunks.length,
      topScore: rerankRes.topScore,
      latencyMs: rerankRes.latencyMs,
    });

    // Stage 8 check early (Validation of retrieved context)
    validationRes = validateRetrievalAndResponse({
      rerankedChunks: rerankRes.rerankedChunks,
      intent: intentRes.intent,
      retryCount,
      maxRetries: 1,
    });

    if (validationRes.shouldRetry && retryCount === 0) {
      retryCount++;
      // Broaden search terms and remove restrictive library filter
      enhanceRes.detectedLibraries = [];
      enhanceRes.enhancedQuery = `${inputRes.cleanedQuery} developer documentation guide`;
      recordStage(8, "Validation & Guardrails (Retry Triggered)", {
        reason: validationRes.reason,
        groundingScore: validationRes.groundingScore,
      });
      continue;
    }

    break;
  }

  recordStage(8, "Validation & Guardrails (Passed)", {
    isSufficient: validationRes.isSufficient,
    groundingScore: validationRes.groundingScore,
    latencyMs: validationRes.latencyMs,
  });

  // Stage 6: Context Assembly
  const contextRes = assembleContext({
    cleanedQuery: inputRes.cleanedQuery,
    history: inputRes.history,
    rerankedChunks: rerankRes.rerankedChunks,
    intent: intentRes.intent,
  });
  recordStage(6, "Context Assembly", {
    documentCount: contextRes.documentCount,
    approxTokens: contextRes.approxTokens,
    latencyMs: contextRes.latencyMs,
  });

  // Stage 9: Citation Generation
  const citationRes = buildCitations({
    rerankedChunks: rerankRes.rerankedChunks,
  });
  recordStage(9, "Source / Citation Generation", {
    citationCount: citationRes.count,
    citations: citationRes.citations,
    latencyMs: citationRes.latencyMs,
  });

  // Stage 7: LLM Generation
  const genRes = await generateResponse({
    messages: contextRes.messages,
    model: model || undefined,
    stream,
    apiKey,
  });
  recordStage(7, "LLM Response Generation", {
    modelUsed: genRes.modelUsed,
    streamMode: genRes.streamMode,
    latencyMs: genRes.latencyMs,
  });

  // Stage 10: Final Response & Cache Write
  if (stream) {
    // Caller handles streaming tokens and then final telemetry
    return {
      streamIterator: genRes.completion,
      citations: citationRes.citations,
      telemetry,
      queryHash,
    };
  }

  const answer = genRes.completion?.choices?.[0]?.message?.content || "";
  await setCache(`query:${queryHash}`, { answer, citations: citationRes.citations });

  recordStage(10, "Final Response & State Persistence", {
    totalLatencyMs: Date.now() - overallStart,
  });

  return {
    answer,
    citations: citationRes.citations,
    telemetry,
    totalLatencyMs: Date.now() - overallStart,
  };
}
