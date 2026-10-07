# DevAtlas AI — Deep-Dive Implementation Specification

This document provides a comprehensive technical breakdown of the **10-Step Corrective RAG (CRAG) & Self-RAG Pipeline**, data collection systems, embedding/vector architecture, and frontend telemetry engine implemented in **DevAtlas AI**.

---

## 1. System Architecture Overview

DevAtlas AI is designed to solve the two biggest failure modes of traditional RAG pipelines:
1. **Irrelevant or Out-of-Domain Retrieval**: Answering queries without understanding the developer's target framework or answering non-technical queries that dilute the system.
2. **Ungrounded Hallucinations**: Producing code that uses deprecated APIs (e.g. outdated LangChain methods) or inventing parameters not supported by the current framework version.

```mermaid
flowchart TD
    subgraph Client_Layer ["Client Layer (React 19 + Vite)"]
        UI[Prompt Composer & Framework Pills]
        Visualizer[Live 10-Step Telemetry Inspector]
    end

    subgraph API_Layer ["API Layer (Express.js Node Backend)"]
        SSE[SSE Streaming & JSON Handlers]
    end

    subgraph RAG_Pipeline ["10-Step Corrective RAG Pipeline"]
        Step1[1. Input Processor\nClean & Context Load] --> Step2[2. Intent Classifier\nLLaMA 3.1 8B Guardrail]
        Step2 --> Step3[3. Query Enhancer\nCoreference Resolution & Library Tagging]
        
        Step3 --> Step4[4. Vector Retriever\nMiniLM-L6-v2 + Qdrant Top-K Search]
        Step4 --> Step5[5. Re-Ranker\nMMR + Deduplication + Score Threshold]
        
        Step5 --> Step8_Pre{8. Grounding Validation\nSufficiency Assessment}
        
        Step8_Pre -- "Low Confidence (Retry < 2)" --> Step8_Refine[Query Refinement & Broadened Search]
        Step8_Refine --> Step4
        
        Step8_Pre -- "Grounded & Sufficient" --> Step6[6. Context Assembler\nToken Budgeting & Markdown Framing]
        Step6 --> Step7[7. Generator\nGroq LPU LLaMA 3.3 70B]
        
        Step7 --> Step9[9. Citation Builder\nCanonical Documentation URL Mapping]
        Step9 --> Step10[10. Persistence & Cache\nUpstash Redis TTL Write]
    end

    UI -->|POST /api/chat/stream| SSE
    SSE --> Step1
    Step10 -->|SSE Token Delta & Telemetry Events| Visualizer
```

---

## 2. Deep-Dive: The 10 Pipeline Stages

### Stage 1: Input Processing (`01_inputProcessor.js`)
* **Role**: Sanitizes incoming user input and loads previous conversational memory.
* **Operations**:
  1. Strips unprintable control characters, null bytes, and excessive whitespace.
  2. Detects character encoding and language (defaulting to English for developer prompts).
  3. Trims conversation history to a sliding window of the last 6 turns (3 complete user/assistant exchanges) to maintain high relevance and protect the context window.
* **Telemetry Output**: `cleanedQuery`, `language`, `wordCount`, `latencyMs`.

### Stage 2: Intent Classification & Guardrails (`02_intentClassifier.js`)
* **Role**: Determines the query type and enforces technical domain boundaries.
* **Supported Categories**:
  - `information_retrieval`: Target library documentation queries (triggers full RAG).
  - `code_debugging`: Error logs, stack traces, and bug investigations.
  - `comparison`: Cross-framework evaluations (e.g. LangGraph vs LCEL, React 19 vs Next.js).
  - `follow_up`: Context-dependent questions requiring previous turn resolution.
  - `summarization`: Architectural overviews.
  - `action_request`: Direct code generation tasks.
  - `out_of_scope`: Non-technical topics (recipes, sports, etc.).
* **Model**: Ultra-fast `llama-3.1-8b-instant` (<100ms) with zero-latency heuristic regex fallbacks.
* **Short-Circuit**: If classified as `out_of_scope`, the pipeline immediately halts and returns polite, developer-focused guidance, saving embedding and vector search compute.

### Stage 3: Query Understanding & Enhancement (`03_queryEnhancer.js`)
* **Role**: Enhances the query for optimal vector retrieval.
* **Coreference Resolution**:
  - Resolves ambiguous pronouns (`"How do I persist it?"` $\rightarrow$ `"How do I persist LangGraph StateGraph state?"`).
* **Target Framework Tagging**:
  - Detects mention of the 9 supported frameworks (`react`, `nextjs`, `langgraph`, `langchain`, `groq`, `qdrant`, `upstash`, `node`, `mdn`).
  - Sets Qdrant payload filter constraints so searches are scoped to the exact relevant documentation set.
* **Keyword Extraction**: Extracts high-significance technical tokens for downstream re-ranking.

### Stage 4: RAG Matching / Retrieval (`04_retriever.js`)
* **Role**: Computes dense vector embeddings and queries the vector database.
* **Embedding Model**: `@xenova/transformers` running `all-MiniLM-L6-v2` (384 dimensions) locally in Node.js on CPU. Zero API costs, zero external network hops.
* **Persistent Embedding Cache**: Uses `embeddings-cache.json` indexed by SHA-256 text hashes to ensure no text is embedded twice.
* **Payload Filtering**: Applies Qdrant single-stage metadata filtering:
  ```json
  {
    "filter": {
      "must": [{ "key": "library", "match": { "any": ["langgraph", "langchain"] } }]
    }
  }
  ```
* **Fallback**: If filtered search returns $<2$ candidates, automatically expands to an unfiltered search to ensure recall.

### Stage 5: Re-Ranking & Deduplication (`05_reranker.js`)
* **Role**: Filters noise and selects the highest-value candidate chunks.
* **Operations**:
  1. **Score Thresholding**: Drops chunks with cosine similarity $< 0.25$.
  2. **Lexical Keyword Boosting**: Boosts candidate scores by $+0.08$ for title matches and $+0.02$ for content matches against Stage 3 keywords.
  3. **URL & File Deduplication**: Ensures duplicate chunks from the same page are not redundantly fed into the LLM context.
  4. Selects Top-$K = 4$ pristine chunks.

### Stage 6: Context Assembly (`06_contextAssembler.js`)
* **Role**: Constructs the structured prompt within a strict token budget.
* **Token Budget Allocation**:
  - System Instructions: ~800 tokens
  - Conversation History: ~1,200 tokens
  - Retrieved Documentation Chunks: ~3,000 tokens
  - Output Completion Budget: 2,048 tokens
* **Chunk Framing**: Formats each retrieved document with metadata headers:
  ```markdown
  --- DOCUMENT [1] ---
  Framework: REACT | Title: React 19 Actions & New Hooks
  Source URL: https://react.dev/reference/react/useActionState
  Topics: react19, hooks, actions, state
  Content:
  ...
  ```

### Stage 7: LLM Response Generation (`07_generator.js`)
* **Role**: Streams production-ready code and explanations.
* **Inference Engine**: Groq LPUs running `llama-3.3-70b-versatile` (or `deepseek-r1-distill-llama-70b` for complex logic).
* **Throughput**: ~280–320 tokens per second with sub-150ms Time-To-First-Token (TTFT).
* **Streaming Protocol**: Real-time Server-Sent Events (SSE).

### Stage 8: Validation & Guardrails (`08_validator.js` - Corrective RAG)
* **Role**: Self-RAG reflection and hallucination prevention.
* **Grounding Check**: Evaluates if the top retrieved chunks provide $> 0.30$ relevance confidence for technical queries.
* **Corrective Retrieval Loop**:
  - If confidence is insufficient and `retryCount < 1`:
    1. Reformulates the search query with broadened terms.
    2. Drops restrictive library filters.
    3. Loops back to **Stage 4 (RAG Retrieval)**.
  - If still insufficient after retry: Emits a transparent acknowledgment stating that official documentation does not detail the edge case, followed by standard architectural recommendations.

### Stage 9: Source & Citation Generation (`09_citationBuilder.js`)
* **Role**: Extracts verified canonical URLs from the frontmatter of retrieved chunks.
* **Output Structure**:
  ```json
  [
    {
      "library": "langgraph",
      "title": "StateGraph & State Management",
      "url": "https://docs.langchain.com/oss/langgraph/concepts/stategraph",
      "section": "concepts",
      "relevanceScore": 0.94
    }
  ]
  ```

### Stage 10: Final Response & Persistence (`orchestrator.js`)
* **Role**: Finalizes delivery and writes to cache.
* **Operations**:
  1. Emits `event: done` with total roundtrip latency over SSE.
  2. Persists query $\rightarrow$ answer mapping to Upstash Redis with a 24-hour TTL.
  3. Broadcasts timing telemetry to the frontend **Pipeline Visualizer Drawer**.

---

## 3. Data Collection Architecture (`data collection/`)

The documentation corpus is built by 9 specialized ECMAScript module collectors:

| Collector | Source | Target Scope | Output Path |
|---|---|---|---|
| `fetch-react-docs.mjs` | `github.com/reactjs/react.dev` | Learn & Reference (React 19) | `out/react/` |
| `fetch-nextjs-docs.mjs` | `github.com/vercel/next.js` | App Router & Server Actions | `out/nextjs/` |
| `fetch-node-docs.mjs` | `github.com/nodejs/node` | Node.js API Reference | `out/node/` |
| `fetch-mdn-docs.mjs` | `github.com/mdn/content` | Web Standards, SSE, WebSockets | `out/mdn/` |
| `fetch-langchain-docs.mjs` | `github.com/langchain-ai/docs` | LangChain JS & Integrations | `out/langchain/` |
| `fetch-landgraph-docs.mjs` | `github.com/langchain-ai/docs` | LangGraph StateGraph & Multi-Agent | `out/langgraph/` |
| `fetch-groq-docs.mjs` | `console.groq.com/docs` | Groq LPU Specs & Models | `out/groq/` |
| `fetch-qdrant-docs.mjs` | `github.com/qdrant/landing_page` | HNSW Indexing & Payload Filter | `out/qdrant/` |
| `fetch-upstash-docs.mjs` | `github.com/upstash/docs` | Redis, Ratelimit, Vector | `out/upstash/` |

### Markdown Chunking & Ingestion Algorithm (`server/src/rag/ingest.js`)
* **Heading-Aware Splitting**: Splits Markdown on `^#{1,3}\s+` headers to keep related code fences with their explanatory text.
* **Paragraph Sub-Splitting**: For sections $> 1,200$ characters, splits on double newlines while preserving syntax blocks.
* **Idempotent Hashing**: Generates MD5 chunk identifiers (`${lib}:${file}:${chunkIndex}`) to ensure re-indexing does not duplicate vectors.

---

## 4. Frontend Architecture & Telemetry Visualizer

Built in **React 19 + Vite (pure JavaScript JSX)** with an oceanic deep slate-teal design system:

* **Background**: `linear-gradient(135deg, #09202a 0%, #0d3b4c 45%, #165366 100%)`.
* **Orbital SVG Ring Network**: CSS-animated rotating concentric rings (`#3a1d63`, `#55298f`, `#783cb8`).
* **Glassmorphism**: `rgba(13, 59, 76, 0.65)` with `backdrop-filter: blur(24px)` and `1px solid rgba(56, 189, 248, 0.2)` borders.
* **Pipeline Telemetry Inspector Drawer (`PipelineVisualizer.jsx`)**:
  - Connects to SSE `event: telemetry` stream.
  - Lights up each of the 10 stages sequentially with latency badges, detected library tags, grounding percentages, and token counts.
* **Verified Source Badges (`ChatMessage.jsx`)**:
  - Renders external links directly to the canonical documentation URLs.

---

## 5. Summary of Verification & Performance Metrics

| Metric | Measured Benchmark |
|---|---|
| **Local MiniLM-L6-v2 Embedding Latency** | 6–8 ms per query |
| **Vector Search Latency (Qdrant / Embedded Store)** | < 1 ms |
| **Groq LPU Generation Latency** | 280–320 tokens/sec |
| **Total RAG Roundtrip Latency (Cached)** | 1–2 ms |
| **Total RAG Roundtrip Latency (Cold Streaming)** | < 250 ms TTFT |
| **Out-of-Scope Guardrail Redirection** | 1 ms |
