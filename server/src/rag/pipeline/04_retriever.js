// server/src/rag/pipeline/04_retriever.js
import { getEmbedding } from "../../services/embeddings.js";
import { searchVectors } from "../../services/qdrant.js";

export async function retrieveChunks({ enhancedQuery, detectedLibraries = [], topK = 8 }) {
  const startTime = Date.now();

  // Generate vector embedding with Xenova all-MiniLM-L6-v2
  const queryVector = await getEmbedding(enhancedQuery);

  // Apply payload filter if libraries detected
  const filter = {};
  if (detectedLibraries.length > 0) {
    filter.library = detectedLibraries;
  }

  let candidates = (await searchVectors(queryVector, filter, topK)) || [];

  // If filtered search returned too few candidates, do an unfiltered fallback
  if (candidates.length < 2 && detectedLibraries.length > 0) {
    const fallbackCandidates = (await searchVectors(queryVector, {}, topK)) || [];
    candidates = fallbackCandidates;
  }

  return {
    candidates,
    candidateCount: candidates.length,
    vectorDim: queryVector.length,
    latencyMs: Date.now() - startTime,
  };
}
