// server/src/config.js
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  port: parseInt(process.env.PORT || "5001", 10),
  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    primaryModel: process.env.GROQ_PRIMARY_MODEL || "openai/gpt-oss-120b",
    fastModel: process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b",
    reasoningModel: "qwen/qwen3.8-27b",
  },
  qdrant: {
    url: process.env.QDRANT_URL || "",
    apiKey: process.env.QDRANT_API_KEY || "",
    collection: process.env.QDRANT_COLLECTION || "devatlas_knowledge",
    vectorDim: 384, // MiniLM-L6-v2 dimension
  },
  upstash: {
    url: process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    ttl: 86400, // 24 hours
  },
  paths: {
    dataCollectionOut: path.resolve(__dirname, "../../data collection/out"),
    cacheDir: path.resolve(__dirname, "../.cache"),
  },
};
