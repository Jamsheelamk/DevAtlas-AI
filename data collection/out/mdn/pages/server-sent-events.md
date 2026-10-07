---
title: "Server-Sent Events (SSE) Protocol"
url: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
library: mdn
section: web-apis
topics: [sse, eventsource, streaming, http]
source: mdn/content (commit 7e91ca0)
license: CC BY-SA 2.5
indexed_at: 2026-10-07
---
# Server-Sent Events (SSE)

Server-Sent Events (SSE) allow a web page to receive real-time text updates from a server over an HTTP connection, using the `text/event-stream` MIME type.

## Response Format

The server sends chunked text lines prefixed with `data:` and terminated by two newlines:

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"token": "Hello"}

data: {"token": " world!"}

data: [DONE]
```
