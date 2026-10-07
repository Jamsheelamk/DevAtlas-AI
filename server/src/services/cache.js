// server/src/services/cache.js
import { Redis } from "@upstash/redis";
import { config } from "../config.js";

let redisClient = null;
const memoryCache = new Map();

export function initCache() {
  if (config.upstash.url && config.upstash.token) {
    try {
      redisClient = new Redis({
        url: config.upstash.url,
        token: config.upstash.token,
      });
      console.log("[Cache] Connected to remote Upstash Redis.");
    } catch (err) {
      console.warn("[Cache] Upstash connection failed, using in-memory cache:", err.message);
      redisClient = null;
    }
  } else {
    console.log("[Cache] UPSTASH_REDIS_REST_URL not configured. Using in-memory LRU cache.");
  }
}

export async function getCache(key) {
  if (redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? (typeof data === "string" ? JSON.parse(data) : data) : null;
    } catch (err) {
      console.warn("[Cache] Remote get failed, checking memory:", err.message);
    }
  }

  const record = memoryCache.get(key);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return record.value;
}

export async function setCache(key, value, ttlSeconds = config.upstash.ttl) {
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), { ex: ttlSeconds });
      return;
    } catch (err) {
      console.warn("[Cache] Remote set failed, storing in memory:", err.message);
    }
  }

  // Memory fallback
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Limit memory cache size
  if (memoryCache.size > 500) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
}
