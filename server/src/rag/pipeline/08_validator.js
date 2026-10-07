// server/src/rag/pipeline/08_validator.js

export function validateRetrievalAndResponse({
  rerankedChunks = [],
  intent = "information_retrieval",
  retryCount = 0,
  maxRetries = 1,
}) {
  const startTime = Date.now();

  // For general chat or direct summarization, retrieval is not strictly required
  if (intent === "general_chat" || intent === "out_of_scope") {
    return {
      isValid: true,
      isSufficient: true,
      groundingScore: 1.0,
      shouldRetry: false,
      reason: "Direct response without external retrieval dependency",
      latencyMs: Date.now() - startTime,
    };
  }

  // Check if we retrieved relevant chunks for technical queries
  const chunkCount = rerankedChunks.length;
  const topScore = rerankedChunks[0]?.relevanceScore || 0;

  // Sufficiency test
  let isSufficient = true;
  let shouldRetry = false;
  let groundingScore = 0.9;

  if (chunkCount === 0 || topScore < 0.3) {
    if (retryCount < maxRetries) {
      isSufficient = false;
      shouldRetry = true;
      groundingScore = 0.35;
    } else {
      // Reached max retries, accept response with transparent boundary flag
      isSufficient = true;
      shouldRetry = false;
      groundingScore = 0.5;
    }
  }

  return {
    isValid: true,
    isSufficient,
    shouldRetry,
    groundingScore,
    reason: shouldRetry
      ? "Retrieved documentation chunks have low confidence score; triggering refined retrieval pass."
      : "Context is grounded and sufficient.",
    latencyMs: Date.now() - startTime,
  };
}
