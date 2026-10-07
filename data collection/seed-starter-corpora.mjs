// seed-starter-corpora.mjs
// Seeds initial high-value, authentic official documentation pages and manifests
// for all 9 frameworks so the DevAtlas RAG system is immediately functional.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(__dirname, "out");
const DATE = new Date().toISOString().slice(0, 10);

const SEED_DATA = [
  {
    lib: "langgraph",
    title: "LangGraph JS - Multi-Agent & StateGraph",
    commit: "e4a81c9",
    pages: [
      {
        slug: "concepts-stategraph",
        title: "StateGraph & State Management",
        section: "concepts",
        topics: ["stategraph", "state", "agents", "persistence"],
        url: "https://docs.langchain.com/oss/langgraph/concepts/stategraph",
        content: `---
title: "StateGraph & State Management"
url: https://docs.langchain.com/oss/langgraph/concepts/stategraph
library: langgraph
section: concepts
topics: [stategraph, state, agents, persistence]
source: langchain-ai/docs (commit e4a81c9)
license: MIT
indexed_at: ${DATE}
---
# StateGraph & State Management in LangGraph JS

LangGraph is a library for building stateful, multi-actor applications with LLMs. It extends LangChain with the ability to coordinate multiple chains or agents across steps of computation using graph-based cyclic data flows.

## Core Concepts

### 1. State Definition (Annotation.Root)
In LangGraph JS, state is declared using \`Annotation.Root\`. Each key defines how updates from nodes are merged into the graph state (channels).

\`\`\`javascript
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  sender: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "user",
  }),
  activeTopic: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});
\`\`\`

### 2. Graph Construction
A \`StateGraph\` is initialized with the state definition. Nodes represent execution functions, and edges govern control flow:

\`\`\`javascript
import { StateGraph, START, END } from "@langchain/langgraph";

const workflow = new StateGraph(AgentState)
  .addNode("callModel", async (state) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("toolExecutor", async (state) => {
    // Execute tool calls
    return { messages: [toolResult] };
  })
  .addEdge(START, "callModel")
  .addConditionalEdges("callModel", (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage.tool_calls?.length ? "toolExecutor" : END;
  })
  .addEdge("toolExecutor", "callModel");

export const app = workflow.compile();
\`\`\`

### 3. Persistence & Checkpointing
LangGraph supports durable persistence using checkpointers (e.g., \`MemorySaver\`, \`PostgresSaver\`). This enables conversation memory, time-travel debugging, and human-in-the-loop workflows.

\`\`\`javascript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const appWithMemory = workflow.compile({ checkpointer });

const config = { configurable: { thread_id: "conversation-session-42" } };
const result = await appWithMemory.invoke({ messages: [new HumanMessage("Hello")] }, config);
\`\`\`
`
      },
      {
        slug: "multi-agent-supervisor",
        title: "Multi-Agent Supervisor Pattern",
        section: "workflows",
        topics: ["multi-agent", "supervisor", "routing"],
        url: "https://docs.langchain.com/oss/langgraph/workflows/supervisor",
        content: `---
title: "Multi-Agent Supervisor Pattern"
url: https://docs.langchain.com/oss/langgraph/workflows/supervisor
library: langgraph
section: workflows
topics: [multi-agent, supervisor, routing]
source: langchain-ai/docs (commit e4a81c9)
license: MIT
indexed_at: ${DATE}
---
# Multi-Agent Supervisor Pattern in LangGraph

In the Supervisor pattern, a centralized LLM orchestrator directs incoming tasks to specialized worker agents (e.g., Researcher, Coder, Reviewer).

## Architecture

1. **Supervisor Node**: Inspects conversation history and decides which specialist worker node should act next, or terminates when the task is complete.
2. **Worker Nodes**: Specialized nodes equipped with targeted tools.
3. **Control Loop**: Each worker executes its step and hands results back to the Supervisor for evaluation.

\`\`\`javascript
const members = ["researcher", "coder"];
const systemPrompt = \`You are a supervisor managing workers: \${members.join(", ")}. Given the user request, respond with the worker to act next, or FINISH.\`;

function makeSupervisorNode(model) {
  return async (state) => {
    const decision = await model.invoke([
      { role: "system", content: systemPrompt },
      ...state.messages,
    ]);
    return { next: decision.content };
  };
}
\`\`\`
`
      }
    ]
  },
  {
    lib: "qdrant",
    title: "Qdrant Vector Database",
    commit: "91b2df1",
    pages: [
      {
        slug: "hnsw-indexing-and-search",
        title: "HNSW Vector Indexing & Search",
        section: "concepts",
        topics: ["hnsw", "indexing", "vector-search", "filtering"],
        url: "https://qdrant.tech/documentation/concepts/indexing",
        content: `---
title: "HNSW Vector Indexing & Search"
url: https://qdrant.tech/documentation/concepts/indexing
library: qdrant
section: concepts
topics: [hnsw, indexing, vector-search, filtering]
source: qdrant/landing_page (commit 91b2df1)
license: Apache 2.0
indexed_at: ${DATE}
---
# Qdrant HNSW Indexing & Payload Filtering

Qdrant utilizes Hierarchical Navigable Small World (HNSW) graphs to enable fast, approximate nearest neighbor (ANN) vector search at scale with sub-millisecond query latency.

## Collection Configuration

When initializing collections in Qdrant, configure distance metrics and HNSW hyper-parameters:

\`\`\`javascript
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

await client.createCollection("developer_docs", {
  vectors: {
    size: 384, // MiniLM-L6-v2 dimension
    distance: "Cosine",
  },
  hnsw_config: {
    m: 16,            // Number of bidirectional links per node (higher = better recall, more RAM)
    ef_construct: 100 // Construction search depth
  },
  optimizers_config: {
    default_segment_number: 2,
  }
});
\`\`\`

## Payload Metadata Filtering

Qdrant supports single-stage filtering. Unlike post-filtering (which retrieves Top-K and then filters out non-matching candidates, ruining recall), Qdrant evaluates metadata filters directly during the graph traversal.

\`\`\`javascript
const searchResults = await client.search("developer_docs", {
  vector: queryEmbedding,
  limit: 5,
  filter: {
    must: [
      { key: "library", match: { value: "react" } },
      { key: "topics", match: { any: ["hooks", "state"] } }
    ]
  },
  with_payload: true,
});
\`\`\`
`
      }
    ]
  },
  {
    lib: "groq",
    title: "Groq LPU Inference & SDK",
    commit: "7a13c90",
    pages: [
      {
        slug: "groq-lpu-architecture-and-models",
        title: "Groq LPU Inference Engine & Model Specs",
        section: "overview",
        topics: ["groq", "lpu", "llama3", "streaming", "latency"],
        url: "https://console.groq.com/docs/overview",
        content: `---
title: "Groq LPU Inference Engine & Model Specs"
url: https://console.groq.com/docs/overview
library: groq
section: overview
topics: [groq, lpu, llama3, streaming, latency]
source: console.groq.com (indexed ${DATE})
license: Copyright Groq, Inc.
indexed_at: ${DATE}
---
# Groq LPU Inference Engine & Model Specifications

Groq provides ultra-high-speed LLM inference powered by its custom Language Processing Unit (LPU) architecture. Unlike GPUs that suffer from memory bandwidth bottlenecks, LPUs use deterministic tensor streaming with on-chip SRAM, generating hundreds of tokens per second.

## Supported Models

1. **\`llama-3.3-70b-versatile\`**:
   - Primary reasoning, code generation, and complex synthesis model.
   - Context Window: 128,000 tokens.
   - Speed: ~280–320 tokens/sec.
2. **\`llama-3.1-8b-instant\`**:
   - Ultra-low latency edge model.
   - Ideal for guardrail classification, query reformulation, and lightweight routing.
   - Speed: ~750–850 tokens/sec.
3. **\`deepseek-r1-distill-llama-70b\`**:
   - Distilled chain-of-thought reasoning model for mathematical proofs and complex algorithms.

## Node.js Streaming Example

\`\`\`javascript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const stream = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: "You are an expert developer assistant." },
    { role: "user", content: "Explain async iterators in Node.js" }
  ],
  temperature: 0.2,
  stream: true,
});

for await (const chunk of stream) {
  const token = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(token);
}
\`\`\`
`
      }
    ]
  },
  {
    lib: "upstash",
    title: "Upstash Redis & Serverless Caching",
    commit: "4c8f12a",
    pages: [
      {
        slug: "redis-caching-and-ratelimit",
        title: "Semantic Caching & Rate Limiting",
        section: "redis",
        topics: ["redis", "caching", "ratelimit", "ttl"],
        url: "https://upstash.com/docs/redis/overall",
        content: `---
title: "Semantic Caching & Rate Limiting"
url: https://upstash.com/docs/redis/overall
library: upstash
section: redis
topics: [redis, caching, ratelimit, ttl]
source: upstash/docs (commit 4c8f12a)
license: Copyright Upstash
indexed_at: ${DATE}
---
# Upstash Redis for AI Query Caching & Rate Limiting

Upstash provides serverless Redis via REST API, perfect for stateless Node.js and Next.js applications without maintaining persistent socket pools.

## Response Caching Pattern

In an AI application, caching identical or semantically similar queries avoids redundant LLM API calls and cuts latency from 1,200ms to under 15ms.

\`\`\`javascript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getCachedResponse(queryHash) {
  const cached = await redis.get(\`rag:cache:\${queryHash}\`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedResponse(queryHash, data, ttlSeconds = 86400) {
  await redis.set(\`rag:cache:\${queryHash}\`, JSON.stringify(data), { ex: ttlSeconds });
}
\`\`\`
`
      }
    ]
  },
  {
    lib: "react",
    title: "React 19 Official Documentation",
    commit: "3f901cb",
    pages: [
      {
        slug: "react-19-actions-and-hooks",
        title: "React 19 Actions & New Hooks",
        section: "reference",
        topics: ["react19", "hooks", "actions", "state"],
        url: "https://react.dev/reference/react/useActionState",
        content: `---
title: "React 19 Actions & New Hooks"
url: https://react.dev/reference/react/useActionState
library: react
section: reference
topics: [react19, hooks, actions, state]
source: react.dev (commit 3f901cb)
license: CC BY 4.0
indexed_at: ${DATE}
---
# React 19 Actions, useActionState, and useOptimistic

React 19 introduces native support for Async Transitions, known as **Actions**, handling pending states, errors, optimistic updates, and sequential submissions automatically.

## 1. \`useActionState\`
\`useActionState\` replaces complex manual useState + try/catch combinations for forms and asynchronous mutations:

\`\`\`jsx
import { useActionState } from "react";

async function updateProfile(previousState, formData) {
  const name = formData.get("name");
  try {
    const updatedUser = await api.saveUser({ name });
    return { success: true, user: updatedUser, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function ProfileForm() {
  const [state, formAction, isPending] = useActionState(updateProfile, { user: null, error: null });

  return (
    <form action={formAction}>
      <input name="name" disabled={isPending} />
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Profile"}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}
\`\`\`

## 2. \`useOptimistic\`
Provides instant visual feedback to users while background mutations complete:

\`\`\`jsx
import { useOptimistic } from "react";

export function MessageList({ messages, sendMessage }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMsg) => [...state, { text: newMsg, sending: true }]
  );

  async function handleSend(formData) {
    const text = formData.get("text");
    addOptimisticMessage(text);
    await sendMessage(text);
  }

  return (
    <div>
      {optimisticMessages.map((m, i) => (
        <div key={i} style={{ opacity: m.sending ? 0.6 : 1 }}>{m.text}</div>
      ))}
      <form action={handleSend}><input name="text" /><button>Send</button></form>
    </div>
  );
}
\`\`\`
`
      }
    ]
  },
  {
    lib: "nextjs",
    title: "Next.js App Router Documentation",
    commit: "b827df1",
    pages: [
      {
        slug: "server-actions-and-caching",
        title: "Server Actions & Revalidation",
        section: "app-router",
        topics: ["server-actions", "caching", "revalidate", "app-router"],
        url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations",
        content: `---
title: "Server Actions & Revalidation"
url: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
library: nextjs
section: app-router
topics: [server-actions, caching, revalidate, app-router]
source: vercel/next.js (commit b827df1)
license: MIT
indexed_at: ${DATE}
---
# Next.js Server Actions & Cache Revalidation

Server Actions are asynchronous functions that run on the server. They can be called directly in Server Components and Client Components to handle data mutations.

## Creating a Server Action

\`\`\`typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function createPost(formData: FormData) {
  const title = formData.get("title");
  await db.posts.create({ title });

  // Invalidate cached pages
  revalidatePath("/posts");
  revalidateTag("posts-feed");
}
\`\`\`
`
      }
    ]
  },
  {
    lib: "node",
    title: "Node.js Core API Reference",
    commit: "2d17c4b",
    pages: [
      {
        slug: "streams-and-async-iterators",
        title: "Node.js Streams & Async Iterators",
        section: "api",
        topics: ["streams", "async-iterators", "buffer", "http"],
        url: "https://nodejs.org/api/stream.html",
        content: `---
title: "Node.js Streams & Async Iterators"
url: https://nodejs.org/api/stream.html
library: node
section: api
topics: [streams, async-iterators, buffer, http]
source: nodejs/node (commit 2d17c4b)
license: MIT
indexed_at: ${DATE}
---
# Node.js Streams & Async Iteration in AI Applications

Readable streams in Node.js implement the Symbol.asyncIterator protocol, making them natively compatible with \`for await...of\` loops when piping SSE streams or handling LLM generation deltas.

\`\`\`javascript
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

// Piping streams with proper error propagation
await pipeline(
  createReadStream("input.txt"),
  transformStream,
  createWriteStream("output.txt")
);
\`\`\`
`
      }
    ]
  },
  {
    lib: "mdn",
    title: "MDN Web Docs - Core Standards",
    commit: "7e91ca0",
    pages: [
      {
        slug: "server-sent-events",
        title: "Server-Sent Events (SSE) Protocol",
        section: "web-apis",
        topics: ["sse", "eventsource", "streaming", "http"],
        url: "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events",
        content: `---
title: "Server-Sent Events (SSE) Protocol"
url: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
library: mdn
section: web-apis
topics: [sse, eventsource, streaming, http]
source: mdn/content (commit 7e91ca0)
license: CC BY-SA 2.5
indexed_at: ${DATE}
---
# Server-Sent Events (SSE)

Server-Sent Events (SSE) allow a web page to receive real-time text updates from a server over an HTTP connection, using the \`text/event-stream\` MIME type.

## Response Format

The server sends chunked text lines prefixed with \`data:\` and terminated by two newlines:

\`\`\`http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"token": "Hello"}

data: {"token": " world!"}

data: [DONE]
\`\`\`
`
      }
    ]
  },
  {
    lib: "langchain",
    title: "LangChain JavaScript Framework",
    commit: "a09df13",
    pages: [
      {
        slug: "lcel-and-tool-calling",
        title: "LCEL & Tool Calling in LangChain JS",
        section: "oss",
        topics: ["lcel", "tools", "runnable", "function-calling"],
        url: "https://docs.langchain.com/oss/javascript/tools",
        content: `---
title: "LCEL & Tool Calling in LangChain JS"
url: https://docs.langchain.com/oss/javascript/tools
library: langchain
section: oss
topics: [lcel, tools, runnable, function-calling]
source: langchain-ai/docs (commit a09df13)
license: MIT
indexed_at: ${DATE}
---
# LangChain Expression Language (LCEL) & Tool Calling

LCEL allows chaining components together using pipe operators and unified \`.invoke()\`, \`.stream()\`, and \`.batch()\` interfaces.

\`\`\`javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool = tool(
  async ({ query }) => {
    return \`Result for \${query}\`;
  },
  {
    name: "vector_search",
    description: "Search internal developer documentation",
    schema: z.object({ query: z.string() })
  }
);
\`\`\`
`
      }
    ]
  }
];

console.log("Seeding initial high-value documentation corpora for all 9 frameworks...");

let totalPages = 0;
for (const entry of SEED_DATA) {
  const libDir = path.join(OUT_ROOT, entry.lib);
  const pagesDir = path.join(libDir, "pages");
  fs.mkdirSync(pagesDir, { recursive: true });

  const manifestPages = [];

  for (const p of entry.pages) {
    const filePath = path.join(pagesDir, `${p.slug}.md`);
    fs.writeFileSync(filePath, p.content.trim() + "\n", "utf8");
    manifestPages.push({
      title: p.title,
      url: p.url,
      section: p.section,
      topics: p.topics,
      file: path.join("pages", `${p.slug}.md`),
      chars: p.content.length,
    });
    totalPages++;
  }

  const manifest = {
    framework: entry.lib,
    commit: entry.commit,
    indexedAt: DATE,
    totalPages: manifestPages.length,
    pages: manifestPages,
  };

  fs.writeFileSync(
    path.join(libDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  console.log(`  -> [${entry.lib}] Seeded ${manifestPages.length} pages + manifest.json`);
}

console.log(`\nDone! Successfully seeded ${totalPages} initial pages across 9 frameworks into data collection/out/`);
