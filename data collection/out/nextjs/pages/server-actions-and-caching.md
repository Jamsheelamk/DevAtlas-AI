---
title: "Server Actions & Revalidation"
url: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
library: nextjs
section: app-router
topics: [server-actions, caching, revalidate, app-router]
source: vercel/next.js (commit b827df1)
license: MIT
indexed_at: 2026-10-07
---
# Next.js Server Actions & Cache Revalidation

Server Actions are asynchronous functions that run on the server. They can be called directly in Server Components and Client Components to handle data mutations.

## Creating a Server Action

```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function createPost(formData: FormData) {
  const title = formData.get("title");
  await db.posts.create({ title });

  // Invalidate cached pages
  revalidatePath("/posts");
  revalidateTag("posts-feed");
}
```
