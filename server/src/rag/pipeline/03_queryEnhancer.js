// server/src/rag/pipeline/03_queryEnhancer.js

const FRAMEWORK_PATTERNS = {
  react: [/\breact\b/i, /\bhook\b/i, /\buseactionstate\b/i, /\buseoptimistic\b/i, /\busestate\b/i, /\buseeffect\b/i, /\bjsx\b/i],
  nextjs: [/\bnext\.?js\b/i, /\bapp router\b/i, /\bserver actions?\b/i, /\brevalidate\b/i],
  langgraph: [/\blanggraph\b/i, /\bstategraph\b/i, /\bcheckpoint\b/i, /\bsupervisor\b/i, /\bmemorysaver\b/i],
  langchain: [/\blangchain\b/i, /\blcel\b/i, /\brunnable\b/i],
  groq: [/\bgroq\b/i, /\blpu\b/i, /\bllama-?3\b/i],
  qdrant: [/\bqdrant\b/i, /\bhnsw\b/i, /\bvector search\b/i, /\bann\b/i, /\bembeddings?\b/i],
  upstash: [/\bupstash\b/i, /\bredis\b/i, /\bsemantic cach(e|ing)\b/i, /\bratelimit\b/i],
  node: [/\bnode(?:\.js)?\b/i, /\bstream\b/i, /\basync iterator\b/i, /\beventloop\b/i, /\bbuffer\b/i],
  mdn: [/\bmdn\b/i, /\bsse\b/i, /\beventsource\b/i, /\bfetch api\b/i, /\bwebsocket\b/i],
};

export function enhanceQuery({ cleanedQuery, history = [], userFilter = null }) {
  const startTime = Date.now();

  const detected = new Set();
  if (userFilter && userFilter !== "all") {
    detected.add(userFilter.toLowerCase());
  } else {
    for (const [framework, regexes] of Object.entries(FRAMEWORK_PATTERNS)) {
      if (regexes.some((re) => re.test(cleanedQuery))) {
        detected.add(framework);
      }
    }
  }

  // Coreference resolution from previous turn
  let resolvedQuery = cleanedQuery;
  const lastTurn = history[history.length - 1];
  if (lastTurn && (cleanedQuery.toLowerCase().includes("it") || cleanedQuery.toLowerCase().includes("this") || cleanedQuery.split(" ").length < 4)) {
    const priorKeywords = (lastTurn.content || "").slice(0, 80).replace(/[^\w\s]/g, "");
    if (priorKeywords && !cleanedQuery.toLowerCase().includes(priorKeywords.toLowerCase())) {
      resolvedQuery = `${cleanedQuery} (Context: ${priorKeywords.slice(0, 40)})`;
    }
  }

  // Extract keywords
  const stopWords = new Set(["the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "for", "with", "how", "what", "to"]);
  const keywords = resolvedQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return {
    originalQuery: cleanedQuery,
    enhancedQuery: resolvedQuery,
    detectedLibraries: Array.from(detected),
    keywords,
    latencyMs: Date.now() - startTime,
  };
}
