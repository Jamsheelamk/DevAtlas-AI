// server/src/services/guardrails.js

const TECH_KEYWORDS = [
  "code", "js", "ts", "javascript", "typescript", "python", "react", "next", "nextjs",
  "node", "langchain", "langgraph", "agent", "agents", "rag", "qdrant", "vector",
  "redis", "upstash", "groq", "llm", "embedding", "database", "api", "hook",
  "state", "workflow", "server", "docker", "component", "frontend", "backend",
  "architecture", "prompt", "mcp", "eval", "debug", "function", "stream", "sse"
];

const OUT_OF_SCOPE_TOPICS = [
  "recipe", "cake", "cook", "baking", "diet", "celebrity", "sports",
  "football", "horoscope", "astrology", "movie review", "fashion"
];

export function checkDomainScope(query) {
  const lower = query.toLowerCase().trim();

  // Fast check: definitely out-of-scope keywords
  const isOutOfScope = OUT_OF_SCOPE_TOPICS.some((topic) => lower.includes(topic));
  if (isOutOfScope) {
    return {
      allowed: false,
      reason: "out_of_scope",
      redirectMessage:
        "DevAtlas AI is specialized exclusively for **Software Engineering, AI Agent Systems, and RAG Architectures**.\n\nI can assist you with:\n- Multi-Agent systems with LangGraph\n- Vector search with Qdrant & embeddings\n- React 19, Next.js App Router, or Node.js APIs\n- High-throughput Groq LPU inference & Upstash Redis caching\n\nPlease ask a question related to software or AI development!",
    };
  }

  return {
    allowed: true,
  };
}
