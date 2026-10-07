// server/src/rag/pipeline/06_contextAssembler.js

const SYSTEM_PROMPT = `You are DevAtlas AI, an elite AI Engineering & Developer Assistant specialized in Software Architecture, AI Agents, LangGraph, React 19, Next.js, Qdrant, Upstash Redis, and Groq LPUs.

GUIDELINES:
1. Provide production-ready, verified technical answers, with high-quality code blocks and clear explanations.
2. Ground your explanations in the provided official documentation whenever available.
3. If code is needed, use modern ECMAScript / React 19 / LangGraph patterns.
4. Structure complex answers with headings, bullet points, and syntax-highlighted code blocks with language specifiers.
5. If the documentation does not fully cover an edge case, state what the official doc says, then provide standard industry recommendations.`;

export function assembleContext({
  cleanedQuery,
  history = [],
  rerankedChunks = [],
  intent = "information_retrieval",
}) {
  const startTime = Date.now();

  let contextDocText = "";
  if (rerankedChunks.length > 0) {
    contextDocText = rerankedChunks
      .map((c, i) => {
        const p = c.payload || {};
        return `--- DOCUMENT [${i + 1}] ---
Framework: ${p.library?.toUpperCase() || "TECH"} | Title: ${p.title}
Source URL: ${p.url || "N/A"}
Topics: ${(p.topics || []).join(", ")}
Content:
${p.content}
`;
      })
      .join("\n\n");
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Add conversation history
  for (const h of history) {
    messages.push({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    });
  }

  // Final user message augmented with retrieved context
  let finalUserPrompt = cleanedQuery;
  if (contextDocText) {
    finalUserPrompt = `[OFFICIAL DOCUMENTATION CONTEXT]
${contextDocText}

[USER QUESTION]
${cleanedQuery}

Please answer the user question thoroughly using the official documentation context where relevant.`;
  }

  messages.push({ role: "user", content: finalUserPrompt });

  // Calculate approximate token budget
  const approxTokens = Math.ceil(
    messages.reduce((acc, m) => acc + m.content.length, 0) / 4
  );

  return {
    messages,
    documentCount: rerankedChunks.length,
    approxTokens,
    latencyMs: Date.now() - startTime,
  };
}
