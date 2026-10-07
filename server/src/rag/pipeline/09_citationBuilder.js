// server/src/rag/pipeline/09_citationBuilder.js

export function buildCitations({ rerankedChunks = [] }) {
  const startTime = Date.now();

  const citations = [];
  const seenUrls = new Set();

  for (const chunk of rerankedChunks) {
    const p = chunk.payload || {};
    const url = p.url;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      citations.push({
        library: p.library || "General",
        title: p.title || "Documentation Reference",
        url: url,
        section: p.section || "",
        topics: p.topics || [],
        relevanceScore: chunk.relevanceScore || 0.8,
      });
    }
  }

  return {
    citations,
    count: citations.length,
    latencyMs: Date.now() - startTime,
  };
}
