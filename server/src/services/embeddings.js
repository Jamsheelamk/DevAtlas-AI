// server/src/services/embeddings.js
import { pipeline } from "@xenova/transformers";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

let extractor = null;
const memoryCache = new Map();
const cacheFilePath = path.join(config.paths.cacheDir, "embeddings-cache.json");

// Load persistent disk cache if available
function loadDiskCache() {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const data = JSON.parse(fs.readFileSync(cacheFilePath, "utf8"));
      for (const [k, v] of Object.entries(data)) {
        memoryCache.set(k, v);
      }
    }
  } catch (err) {
    console.warn("[Embeddings] Could not load disk cache:", err.message);
  }
}

function saveDiskCache() {
  try {
    fs.mkdirSync(config.paths.cacheDir, { recursive: true });
    const obj = {};
    for (const [k, v] of memoryCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(cacheFilePath, JSON.stringify(obj), "utf8");
  } catch (err) {
    // Non-fatal warning
  }
}

loadDiskCache();

function hashText(text) {
  return crypto.createHash("sha256").update(text.trim()).digest("hex");
}

export async function getEmbedding(text) {
  const hash = hashText(text);
  if (memoryCache.has(hash)) {
    return memoryCache.get(hash);
  }

  if (!extractor) {
    console.log("[Embeddings] Initializing Xenova/all-MiniLM-L6-v2 model...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });
  }

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  const vector = Array.from(output.data);
  memoryCache.set(hash, vector);

  // Periodic persist
  if (memoryCache.size % 20 === 0) {
    saveDiskCache();
  }

  return vector;
}

export async function batchEmbed(texts, onProgress = null) {
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    const vector = await getEmbedding(texts[i]);
    results.push(vector);
    if (onProgress && (i + 1) % 5 === 0) {
      onProgress(i + 1, texts.length);
    }
  }
  saveDiskCache();
  return results;
}
