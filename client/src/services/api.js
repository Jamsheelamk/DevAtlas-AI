// client/src/services/api.js

export async function fetchHealth() {
  try {
    const res = await fetch("/api/health");
    return await res.json();
  } catch (err) {
    return { status: "offline", error: err.message };
  }
}

export async function fetchKnowledgeCorpora() {
  try {
    const res = await fetch("/api/knowledge");
    return await res.json();
  } catch (err) {
    return { frameworks: [], totalPoints: 0, error: err.message };
  }
}

export async function saveSettings(settings) {
  const res = await fetch("/api/health/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return await res.json();
}

/**
 * Streams chat response over Server-Sent Events (SSE)
 */
export async function streamChat({
  query,
  history = [],
  filter = null,
  model = null,
  apiKey = null,
  onToken = () => {},
  onTelemetry = () => {},
  onCitations = () => {},
  onDone = () => {},
  onError = () => {},
}) {
  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, history, filter, model, apiKey }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/^event:\s*(\w+)/m);
        const dataMatch = block.match(/^data:\s*(.+)$/m);

        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1]);
            const eventType = eventMatch ? eventMatch[1] : "message";

            if (eventType === "telemetry") {
              onTelemetry(data);
            } else if (eventType === "citations") {
              onCitations(data);
            } else if (eventType === "token") {
              onToken(data.token);
            } else if (eventType === "done") {
              onDone(data);
            } else if (eventType === "error") {
              onError(data.error);
            }
          } catch (e) {
            console.warn("SSE parse error", e);
          }
        }
      }
    }
  } catch (err) {
    console.error("Stream connection failed", err);
    onError(err.message);
  }
}
