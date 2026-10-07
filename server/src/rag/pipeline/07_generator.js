// server/src/rag/pipeline/07_generator.js
import { createChatCompletion } from "../../services/groq.js";
import { config } from "../../config.js";

export async function generateResponse({
  messages,
  model = config.groq.primaryModel,
  temperature = 0.2,
  stream = false,
  apiKey = null,
}) {
  const startTime = Date.now();

  const completion = await createChatCompletion({
    messages,
    model,
    temperature,
    stream,
    apiKey,
  });

  return {
    completion,
    modelUsed: model,
    streamMode: stream,
    latencyMs: Date.now() - startTime,
  };
}
