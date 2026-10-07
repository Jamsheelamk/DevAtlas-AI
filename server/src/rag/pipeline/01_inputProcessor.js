// server/src/rag/pipeline/01_inputProcessor.js

export function processInput({ query, history = [] }) {
  const startTime = Date.now();

  // Clean and normalize text
  const cleaned = (query || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // strip control characters
    .replace(/\s+/g, " ")
    .trim();

  // Basic language detection
  const hasNonAscii = /[^\u0000-\u007F]/.test(cleaned);
  const detectedLanguage = hasNonAscii ? "multilingual" : "en";

  // Context window trimming: keep last 6 turns (3 exchanges)
  const sanitizedHistory = (history || []).slice(-6).map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: (msg.content || "").trim(),
  }));

  return {
    rawQuery: query,
    cleanedQuery: cleaned,
    language: detectedLanguage,
    history: sanitizedHistory,
    wordCount: cleaned.split(/\s+/).length,
    latencyMs: Date.now() - startTime,
  };
}
