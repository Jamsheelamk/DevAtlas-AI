// server/src/routes/knowledge.js
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getVectorStats } from "../services/qdrant.js";
import { ingestAllCorpora } from "../rag/ingest.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const stats = getVectorStats();
    const outRoot = config.paths.dataCollectionOut;

    const frameworkDetails = [];
    if (fs.existsSync(outRoot)) {
      const dirs = fs.readdirSync(outRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const dir of dirs) {
        const manifestPath = path.join(outRoot, dir, "manifest.json");
        let manifest = null;
        if (fs.existsSync(manifestPath)) {
          try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
          } catch (e) {}
        }
        frameworkDetails.push({
          id: dir,
          name: dir.toUpperCase(),
          manifest,
          chunkCount: stats.libraries[dir.toLowerCase()] || 0,
        });
      }
    }

    res.json({
      totalPoints: stats.totalPoints,
      isLocalStore: stats.isLocal,
      frameworks: frameworkDetails,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sync", async (req, res) => {
  try {
    const result = await ingestAllCorpora();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
