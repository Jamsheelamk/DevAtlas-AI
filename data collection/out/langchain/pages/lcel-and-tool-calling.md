---
title: "LCEL & Tool Calling in LangChain JS"
url: https://docs.langchain.com/oss/javascript/tools
library: langchain
section: oss
topics: [lcel, tools, runnable, function-calling]
source: langchain-ai/docs (commit a09df13)
license: MIT
indexed_at: 2026-10-07
---
# LangChain Expression Language (LCEL) & Tool Calling

LCEL allows chaining components together using pipe operators and unified `.invoke()`, `.stream()`, and `.batch()` interfaces.

```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool = tool(
  async ({ query }) => {
    return `Result for ${query}`;
  },
  {
    name: "vector_search",
    description: "Search internal developer documentation",
    schema: z.object({ query: z.string() })
  }
);
```
