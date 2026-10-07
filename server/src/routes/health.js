// server/src/routes/health.js
import express from "express";
import { config } from "../config.js";
import { getVectorStats } from "../services/qdrant.js";
import { updateGroqApiKey } from "../services/groq.js";

const router = express.Router();

router.get("/", (req, res) => {
  const vectorStats = getVectorStats();

  res.json({
    status: "ok",
    version: "1.0.0",
    service: "DevAtlas AI Backend",
    timestamp: new Date().toISOString(),
    components: {
      embeddings: {
        status: "ready",
        model: "Xenova/all-MiniLM-L6-v2 (local, free)",
      },
      vectorStore: {
        status: "active",
        type: vectorStats.isLocal ? "Embedded Cosine Vector Store" : "Remote Qdrant",
        indexedPoints: vectorStats.totalPoints,
      },
      cache: {
        status: "active",
        type: config.upstash.url ? "Upstash Redis" : "In-Memory LRU Cache",
      },
      groq: {
        status: config.groq.apiKey ? "configured" : "simulation_mode",
        primaryModel: config.groq.primaryModel,
        fastModel: config.groq.fastModel,
      },
    },
  });
});

router.post("/settings", (req, res) => {
  const { groqApiKey, primaryModel } = req.body;

  if (groqApiKey !== undefined) {
    updateGroqApiKey(groqApiKey);
  }
  if (primaryModel) {
    config.groq.primaryModel = primaryModel;
  }

  res.json({
    success: true,
    message: "Settings updated successfully",
    configured: Boolean(config.groq.apiKey),
    primaryModel: config.groq.primaryModel,
  });
});

export default router;
