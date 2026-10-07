// server/src/routes/chat.js
import express from "express";
import { executeRAGPipeline } from "../rag/pipeline/orchestrator.js";
import { setCache } from "../services/cache.js";

const router = express.Router();

/**
 * Standard JSON endpoint: POST /api/chat
 */
router.post("/", async (req, res) => {
  try {
    const { query, history = [], filter = null, model = null, apiKey = null } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    const result = await executeRAGPipeline({
      query,
      history,
      userFilter: filter,
      model,
      apiKey,
      stream: false,
    });

    res.json(result);
  } catch (err) {
    console.error("[Chat Route Error]", err);
    res.status(500).json({ error: err.message || "Failed to process chat query" });
  }
});

/**
 * Server-Sent Events (SSE) Streaming endpoint: POST /api/chat/stream
 */
router.post("/stream", async (req, res) => {
  const { query, history = [], filter = null, model = null, apiKey = null } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  // Setup SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await executeRAGPipeline({
      query,
      history,
      userFilter: filter,
      model,
      apiKey,
      stream: true,
      onTelemetry: (stageData) => {
        sendEvent("telemetry", stageData);
      },
    });

    // Send citations upfront
    if (result.citations) {
      sendEvent("citations", result.citations);
    }

    // Stream tokens
    let fullAnswer = "";
    if (result.streamIterator) {
      for await (const chunk of result.streamIterator) {
        const token = chunk.choices?.[0]?.delta?.content || "";
        if (token) {
          fullAnswer += token;
          sendEvent("token", { token });
        }
      }
    } else if (result.answer) {
      fullAnswer = result.answer;
      sendEvent("token", { token: fullAnswer });
    }

    // Persist full answer to cache
    if (result.queryHash && fullAnswer) {
      await setCache(`query:${result.queryHash}`, {
        answer: fullAnswer,
        citations: result.citations,
      });
    }

    sendEvent("done", {
      success: true,
      telemetry: result.telemetry,
    });

    res.end();
  } catch (err) {
    console.error("[Chat Stream Error]", err);
    sendEvent("error", { error: err.message });
    res.end();
  }
});

export default router;
