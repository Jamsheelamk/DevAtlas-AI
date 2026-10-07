---
title: "Groq LPU Inference Engine & Model Specs"
url: https://console.groq.com/docs/overview
library: groq
section: overview
topics: [groq, lpu, llama3, streaming, latency]
source: console.groq.com (indexed 2026-10-07)
license: Copyright Groq, Inc.
indexed_at: 2026-10-07
---
# Groq LPU Inference Engine & Model Specifications

Groq provides ultra-high-speed LLM inference powered by its custom Language Processing Unit (LPU) architecture. Unlike GPUs that suffer from memory bandwidth bottlenecks, LPUs use deterministic tensor streaming with on-chip SRAM, generating hundreds of tokens per second.

## Supported Models

1. **`llama-3.3-70b-versatile`**:
   - Primary reasoning, code generation, and complex synthesis model.
   - Context Window: 128,000 tokens.
   - Speed: ~280–320 tokens/sec.
2. **`llama-3.1-8b-instant`**:
   - Ultra-low latency edge model.
   - Ideal for guardrail classification, query reformulation, and lightweight routing.
   - Speed: ~750–850 tokens/sec.
3. **`deepseek-r1-distill-llama-70b`**:
   - Distilled chain-of-thought reasoning model for mathematical proofs and complex algorithms.

## Node.js Streaming Example

```javascript
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
```
