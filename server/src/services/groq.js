// server/src/services/groq.js
import Groq from "groq-sdk";
import { config } from "../config.js";

let groqInstance = null;

export function getGroqClient(apiKeyOverride = null) {
  const key = apiKeyOverride || config.groq.apiKey;
  if (!key) return null;
  if (!groqInstance || apiKeyOverride) {
    groqInstance = new Groq({ apiKey: key });
  }
  return groqInstance;
}

export function updateGroqApiKey(newKey) {
  config.groq.apiKey = newKey;
  groqInstance = newKey ? new Groq({ apiKey: newKey }) : null;
}

/**
 * Stream or call completion from Groq LPU
 */
export async function createChatCompletion({
  messages,
  model = config.groq.primaryModel,
  temperature = 0.2,
  maxTokens = 2048,
  stream = false,
  apiKey = null,
}) {
  const client = getGroqClient(apiKey);

  if (!client) {
    // Development simulation mode with realistic streaming
    return simulateDevelopmentResponse(messages, stream);
  }

  try {
    return await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    });
  } catch (err) {
    console.error(`[Groq Error] ${err.message}. Falling back to simulation if unauthenticated.`);
    if (err.status === 401 || err.message?.includes("API key")) {
      return simulateDevelopmentResponse(messages, stream);
    }
    throw err;
  }
}

/**
 * Quick non-streaming call (ideal for Stage 2 Intent & Stage 8 Validation)
 */
export async function createFastCompletion({
  prompt,
  systemPrompt = "You are a fast classifier and analyzer.",
  model = config.groq.fastModel,
  temperature = 0.1,
  apiKey = null,
}) {
  const client = getGroqClient(apiKey);
  if (!client) {
    return null; // Return null so pipeline uses heuristic fallback
  }

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature,
      max_tokens: 300,
      stream: false,
    });
    return res.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.warn("[Groq Fast Call Error]", err.message);
    return null;
  }
}

// Development simulation fallback when user hasn't set GROQ_API_KEY
async function* simulateTokens(text) {
  const words = text.split(" ");
  for (const word of words) {
    await new Promise((r) => setTimeout(r, 22));
    yield {
      choices: [
        {
          delta: { content: word + " " },
        },
      ],
    };
  }
}

function simulateDevelopmentResponse(messages, stream) {
  const userMsg = messages[messages.length - 1]?.content || "";
  const simText = `### DevAtlas AI Architectural Guidance

*(Note: Running in zero-config development simulation mode. To enable live high-speed Groq LPU inference, add your free \`GROQ_API_KEY\` in Settings or \`.env\`)*

Regarding your query: **"${userMsg.slice(0, 100)}"**

Based on verified architectural guidelines:
1. **Core Pattern**: When designing stateful workflows (e.g. with **LangGraph** or **React 19 Actions**), maintain explicit unidirectional state channels and checkpoints.
2. **Vector Indexing**: Use **Qdrant** with HNSW indexing and metadata filtering for sub-millisecond retrieval.
3. **Caching**: Store semantic embeddings and response payloads in **Upstash Redis** to cut latency.

\`\`\`javascript
// Example Production Integration
import { StateGraph } from "@langchain/langgraph";
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({ url: "http://localhost:6333" });
console.log("Vector retrieval initialized with sub-millisecond latency.");
\`\`\`
`;

  if (stream) {
    return simulateTokens(simText);
  }
  return {
    choices: [
      {
        message: { content: simText },
      },
    ],
  };
}
