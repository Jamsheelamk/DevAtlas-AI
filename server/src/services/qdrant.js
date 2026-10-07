// server/src/services/qdrant.js
import { QdrantClient } from "@qdrant/js-client-rest";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

let qdrantClient = null;
let useLocalStore = true;

// In-memory + persistent fallback store
let localStore = [];
const localStorePath = path.join(config.paths.cacheDir, "local_vectors.json");

function loadLocalStore() {
  try {
    if (fs.existsSync(localStorePath)) {
      localStore = JSON.parse(fs.readFileSync(localStorePath, "utf8"));
      console.log(`[VectorStore] Loaded ${localStore.length} points from local disk store.`);
    }
  } catch (err) {
    console.warn("[VectorStore] Could not load local vectors:", err.message);
  }
}

function saveLocalStore() {
  try {
    fs.mkdirSync(config.paths.cacheDir, { recursive: true });
    fs.writeFileSync(localStorePath, JSON.stringify(localStore, null, 2), "utf8");
  } catch (err) {
    // Non-fatal
  }
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function initQdrant() {
  loadLocalStore();

  if (config.qdrant.url) {
    try {
      qdrantClient = new QdrantClient({
        url: config.qdrant.url,
        apiKey: config.qdrant.apiKey || undefined,
      });

      const collections = await qdrantClient.getCollections();
      const exists = collections.collections.some((c) => c.name === config.qdrant.collection);

      if (!exists) {
        await qdrantClient.createCollection(config.qdrant.collection, {
          vectors: {
            size: config.qdrant.vectorDim,
            distance: "Cosine",
          },
        });
        console.log(`[Qdrant] Created collection "${config.qdrant.collection}"`);
      }
      useLocalStore = false;
      console.log(`[Qdrant] Connected to remote Qdrant cluster at ${config.qdrant.url}`);
    } catch (err) {
      console.warn(`[Qdrant] Failed to connect to remote Qdrant (${err.message}). Using local high-performance vector store.`);
      useLocalStore = true;
    }
  } else {
    console.log("[VectorStore] QDRANT_URL not set. Running embedded Cosine Vector Store.");
    useLocalStore = true;
  }
}

function toUUID(hex) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hex)) {
    return hex;
  }
  const clean = hex.replace(/[^0-9a-f]/gi, "").padEnd(32, "0").slice(0, 32);
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
}

export async function upsertPoints(points) {
  if (!useLocalStore && qdrantClient) {
    try {
      await qdrantClient.upsert(config.qdrant.collection, {
        wait: true,
        points: points.map((p) => ({
          id: toUUID(p.id),
          vector: p.vector,
          payload: p.payload,
        })),
      });
      return;
    } catch (err) {
      console.warn("[Qdrant] Remote upsert failed, saving to local store:", err.message);
    }
  }

  // Local store upsert
  for (const p of points) {
    const idx = localStore.findIndex((x) => x.id === p.id);
    if (idx >= 0) {
      localStore[idx] = p;
    } else {
      localStore.push(p);
    }
  }
  saveLocalStore();
}

export async function searchVectors(queryVector, filter = {}, limit = 8) {
  if (!useLocalStore && qdrantClient) {
    try {
      const qdrantFilter = {};
      if (filter.library) {
        qdrantFilter.must = [
          {
            key: "library",
            match: Array.isArray(filter.library)
              ? { any: filter.library }
              : { value: filter.library },
          },
        ];
      }

      let rawPoints = [];
      if (typeof qdrantClient.query === "function") {
        const res = await qdrantClient.query(config.qdrant.collection, {
          query: queryVector,
          limit,
          filter: Object.keys(qdrantFilter).length ? qdrantFilter : undefined,
          with_payload: true,
        });
        rawPoints = res?.points || (Array.isArray(res) ? res : []);
      } else if (typeof qdrantClient.search === "function") {
        rawPoints = await qdrantClient.search(config.qdrant.collection, {
          vector: queryVector,
          limit,
          filter: Object.keys(qdrantFilter).length ? qdrantFilter : undefined,
          with_payload: true,
        });
      }

      if (Array.isArray(rawPoints) && rawPoints.length > 0) {
        return rawPoints.map((r) => ({
          id: r.id,
          score: r.score || 0.8,
          payload: r.payload || {},
        }));
      }
    } catch (err) {
      console.warn("[Qdrant] Remote search failed, falling back to local search:", err.message);
    }
  }

  // Local vector search with payload filtering
  let candidates = localStore || [];

  if (filter.library && filter.library.length > 0) {
    const allowedLibs = Array.isArray(filter.library) ? filter.library : [filter.library];
    candidates = candidates.filter((item) =>
      allowedLibs.includes(item.payload?.library?.toLowerCase())
    );
  }

  const scored = candidates.map((item) => {
    const score = cosineSimilarity(queryVector, item.vector);
    return {
      id: item.id,
      score,
      payload: item.payload,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function getVectorStats() {
  const libCounts = {};
  for (const item of localStore) {
    const lib = item.payload?.library || "general";
    libCounts[lib] = (libCounts[lib] || 0) + 1;
  }
  return {
    totalPoints: localStore.length,
    isLocal: useLocalStore,
    libraries: libCounts,
  };
}
