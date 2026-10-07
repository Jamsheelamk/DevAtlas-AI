// server/src/index.js
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initQdrant, getVectorStats } from "./services/qdrant.js";
import { initCache } from "./services/cache.js";
import { ingestAllCorpora } from "./rag/ingest.js";
import chatRouter from "./routes/chat.js";
import knowledgeRouter from "./routes/knowledge.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/api/chat", chatRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/health", healthRouter);

// Root
app.get("/", (req, res) => {
  res.json({
    name: "DevAtlas AI API",
    status: "online",
    documentation: "/api/health",
  });
});

async function startServer() {
  console.log("=================================================");
  console.log("   DevAtlas AI - Backend Server Starting        ");
  console.log("=================================================");

  // Initialize infrastructure
  await initQdrant();
  initCache();

  // Auto-ingest docs if empty
  const stats = getVectorStats();
  if (stats.totalPoints === 0) {
    console.log("[Bootstrap] Vector store empty. Ingesting starter corpora...");
    await ingestAllCorpora();
  } else {
    console.log(`[Bootstrap] Vector store ready with ${stats.totalPoints} points.`);
  }

  app.listen(config.port, () => {
    console.log(`\n🚀 DevAtlas AI server listening at http://localhost:${config.port}`);
    console.log(`👉 Health check: http://localhost:${config.port}/api/health\n`);
  });
}

startServer().catch((err) => {
  console.error("[Fatal Startup Error]", err);
  process.exit(1);
});
