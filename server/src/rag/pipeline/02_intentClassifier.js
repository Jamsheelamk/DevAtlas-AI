// server/src/rag/pipeline/02_intentClassifier.js
import { checkDomainScope } from "../../services/guardrails.js";
import { createFastCompletion } from "../../services/groq.js";

export async function classifyIntent({ cleanedQuery, history = [], apiKey = null }) {
  const startTime = Date.now();

  // 1. Domain guardrail check
  const scope = checkDomainScope(cleanedQuery);
  if (!scope.allowed) {
    return {
      intent: "out_of_scope",
      confidence: 1.0,
      redirectMessage: scope.redirectMessage,
      latencyMs: Date.now() - startTime,
    };
  }

  // 2. Fast heuristic classification
  const lower = cleanedQuery.toLowerCase();
  let heuristicIntent = "information_retrieval";

  if (lower.includes("compare") || lower.includes("vs") || lower.includes("difference between")) {
    heuristicIntent = "comparison";
  } else if (lower.includes("error") || lower.includes("bug") || lower.includes("fix") || lower.includes("debug") || lower.includes("fails")) {
    heuristicIntent = "code_debugging";
  } else if (history.length > 0 && (lower.startsWith("why") || lower.startsWith("how about") || lower.startsWith("and what if") || lower.includes("that") || lower.includes("it"))) {
    heuristicIntent = "follow_up";
  } else if (lower.includes("summarize") || lower.includes("overview") || lower.includes("tldr")) {
    heuristicIntent = "summarization";
  } else if (lower.includes("write") || lower.includes("create") || lower.includes("generate") || lower.includes("build")) {
    heuristicIntent = "action_request";
  }

  // Optional fast LLM verification with llama-3.1-8b-instant
  let llmIntent = null;
  const prompt = `Classify this software engineering user query into ONE of: [information_retrieval, code_debugging, comparison, follow_up, summarization, action_request, general_chat].
Query: "${cleanedQuery}"
Respond ONLY with the category name.`;

  const fastRes = await createFastCompletion({
    prompt,
    systemPrompt: "You are an accurate intent classifier.",
    apiKey,
  });

  if (fastRes) {
    const cleanedRes = fastRes.toLowerCase().replace(/[^a-z_]/g, "");
    if (["information_retrieval", "code_debugging", "comparison", "follow_up", "summarization", "action_request", "general_chat"].includes(cleanedRes)) {
      llmIntent = cleanedRes;
    }
  }

  const finalIntent = llmIntent || heuristicIntent;

  return {
    intent: finalIntent,
    confidence: llmIntent ? 0.95 : 0.82,
    redirectMessage: null,
    latencyMs: Date.now() - startTime,
  };
}
