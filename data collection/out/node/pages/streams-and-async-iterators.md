---
title: "Node.js Streams & Async Iterators"
url: https://nodejs.org/api/stream.html
library: node
section: api
topics: [streams, async-iterators, buffer, http]
source: nodejs/node (commit 2d17c4b)
license: MIT
indexed_at: 2026-10-07
---
# Node.js Streams & Async Iteration in AI Applications

Readable streams in Node.js implement the Symbol.asyncIterator protocol, making them natively compatible with `for await...of` loops when piping SSE streams or handling LLM generation deltas.

```javascript
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

// Piping streams with proper error propagation
await pipeline(
  createReadStream("input.txt"),
  transformStream,
  createWriteStream("output.txt")
);
```
