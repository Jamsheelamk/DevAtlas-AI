---
title: "Multi-Agent Supervisor Pattern"
url: https://docs.langchain.com/oss/langgraph/workflows/supervisor
library: langgraph
section: workflows
topics: [multi-agent, supervisor, routing]
source: langchain-ai/docs (commit e4a81c9)
license: MIT
indexed_at: 2026-10-07
---
# Multi-Agent Supervisor Pattern in LangGraph

In the Supervisor pattern, a centralized LLM orchestrator directs incoming tasks to specialized worker agents (e.g., Researcher, Coder, Reviewer).

## Architecture

1. **Supervisor Node**: Inspects conversation history and decides which specialist worker node should act next, or terminates when the task is complete.
2. **Worker Nodes**: Specialized nodes equipped with targeted tools.
3. **Control Loop**: Each worker executes its step and hands results back to the Supervisor for evaluation.

```javascript
const members = ["researcher", "coder"];
const systemPrompt = `You are a supervisor managing workers: ${members.join(", ")}. Given the user request, respond with the worker to act next, or FINISH.`;

function makeSupervisorNode(model) {
  return async (state) => {
    const decision = await model.invoke([
      { role: "system", content: systemPrompt },
      ...state.messages,
    ]);
    return { next: decision.content };
  };
}
```
