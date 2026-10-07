---
title: "StateGraph & State Management"
url: https://docs.langchain.com/oss/langgraph/concepts/stategraph
library: langgraph
section: concepts
topics: [stategraph, state, agents, persistence]
source: langchain-ai/docs (commit e4a81c9)
license: MIT
indexed_at: 2026-10-07
---
# StateGraph & State Management in LangGraph JS

LangGraph is a library for building stateful, multi-actor applications with LLMs. It extends LangChain with the ability to coordinate multiple chains or agents across steps of computation using graph-based cyclic data flows.

## Core Concepts

### 1. State Definition (Annotation.Root)
In LangGraph JS, state is declared using `Annotation.Root`. Each key defines how updates from nodes are merged into the graph state (channels).

```javascript
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  sender: Annotation({
    reducer: (curr, update) => update ?? curr,
    default: () => "user",
  }),
  activeTopic: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});
```

### 2. Graph Construction
A `StateGraph` is initialized with the state definition. Nodes represent execution functions, and edges govern control flow:

```javascript
import { StateGraph, START, END } from "@langchain/langgraph";

const workflow = new StateGraph(AgentState)
  .addNode("callModel", async (state) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("toolExecutor", async (state) => {
    // Execute tool calls
    return { messages: [toolResult] };
  })
  .addEdge(START, "callModel")
  .addConditionalEdges("callModel", (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage.tool_calls?.length ? "toolExecutor" : END;
  })
  .addEdge("toolExecutor", "callModel");

export const app = workflow.compile();
```

### 3. Persistence & Checkpointing
LangGraph supports durable persistence using checkpointers (e.g., `MemorySaver`, `PostgresSaver`). This enables conversation memory, time-travel debugging, and human-in-the-loop workflows.

```javascript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const appWithMemory = workflow.compile({ checkpointer });

const config = { configurable: { thread_id: "conversation-session-42" } };
const result = await appWithMemory.invoke({ messages: [new HumanMessage("Hello")] }, config);
```
