---
title: "HNSW Vector Indexing & Search"
url: https://qdrant.tech/documentation/concepts/indexing
library: qdrant
section: concepts
topics: [hnsw, indexing, vector-search, filtering]
source: qdrant/landing_page (commit 91b2df1)
license: Apache 2.0
indexed_at: 2026-10-07
---
# Qdrant HNSW Indexing & Payload Filtering

Qdrant utilizes Hierarchical Navigable Small World (HNSW) graphs to enable fast, approximate nearest neighbor (ANN) vector search at scale with sub-millisecond query latency.

## Collection Configuration

When initializing collections in Qdrant, configure distance metrics and HNSW hyper-parameters:

```javascript
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

await client.createCollection("developer_docs", {
  vectors: {
    size: 384, // MiniLM-L6-v2 dimension
    distance: "Cosine",
  },
  hnsw_config: {
    m: 16,            // Number of bidirectional links per node (higher = better recall, more RAM)
    ef_construct: 100 // Construction search depth
  },
  optimizers_config: {
    default_segment_number: 2,
  }
});
```

## Payload Metadata Filtering

Qdrant supports single-stage filtering. Unlike post-filtering (which retrieves Top-K and then filters out non-matching candidates, ruining recall), Qdrant evaluates metadata filters directly during the graph traversal.

```javascript
const searchResults = await client.search("developer_docs", {
  vector: queryEmbedding,
  limit: 5,
  filter: {
    must: [
      { key: "library", match: { value: "react" } },
      { key: "topics", match: { any: ["hooks", "state"] } }
    ]
  },
  with_payload: true,
});
```
