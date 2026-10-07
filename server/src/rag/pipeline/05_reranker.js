// server/src/rag/pipeline/05_reranker.js

export function rerankChunks({ candidates = [], keywords = [], minScore = 0.25, topK = 4 }) {
  const startTime = Date.now();

  if (!candidates || candidates.length === 0) {
    return {
      rerankedChunks: [],
      droppedCount: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  // 1. Filter out low score items
  const valid = candidates.filter((item) => (item.score || 0) >= minScore);

  // 2. Compute keyword boost
  const scored = valid.map((item) => {
    let boost = 0.0;
    const contentLower = (item.payload?.content || "").toLowerCase();
    const titleLower = (item.payload?.title || "").toLowerCase();

    for (const kw of keywords) {
      if (titleLower.includes(kw)) boost += 0.08;
      if (contentLower.includes(kw)) boost += 0.02;
    }

    const finalScore = (item.score || 0) + Math.min(boost, 0.25);
    return {
      ...item,
      relevanceScore: parseFloat(finalScore.toFixed(4)),
    };
  });

  // Sort by boosted score
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // 3. Deduplication (by URL or file)
  const seenUrls = new Set();
  const deduped = [];
  for (const item of scored) {
    const key = `${item.payload?.url || item.payload?.file}:${item.payload?.chunkIndex}`;
    if (!seenUrls.has(key)) {
      seenUrls.add(key);
      deduped.push(item);
    }
    if (deduped.length >= topK) break;
  }

  return {
    rerankedChunks: deduped,
    droppedCount: candidates.length - deduped.length,
    topScore: deduped[0]?.relevanceScore || 0,
    latencyMs: Date.now() - startTime,
  };
}
