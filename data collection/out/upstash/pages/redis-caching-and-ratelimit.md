---
title: "Semantic Caching & Rate Limiting"
url: https://upstash.com/docs/redis/overall
library: upstash
section: redis
topics: [redis, caching, ratelimit, ttl]
source: upstash/docs (commit 4c8f12a)
license: Copyright Upstash
indexed_at: 2026-10-07
---
# Upstash Redis for AI Query Caching & Rate Limiting

Upstash provides serverless Redis via REST API, perfect for stateless Node.js and Next.js applications without maintaining persistent socket pools.

## Response Caching Pattern

In an AI application, caching identical or semantically similar queries avoids redundant LLM API calls and cuts latency from 1,200ms to under 15ms.

```javascript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getCachedResponse(queryHash) {
  const cached = await redis.get(`rag:cache:${queryHash}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedResponse(queryHash, data, ttlSeconds = 86400) {
  await redis.set(`rag:cache:${queryHash}`, JSON.stringify(data), { ex: ttlSeconds });
}
```
