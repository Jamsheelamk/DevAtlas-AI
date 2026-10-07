---
title: "React 19 Actions & New Hooks"
url: https://react.dev/reference/react/useActionState
library: react
section: reference
topics: [react19, hooks, actions, state]
source: react.dev (commit 3f901cb)
license: CC BY 4.0
indexed_at: 2026-10-07
---
# React 19 Actions, useActionState, and useOptimistic

React 19 introduces native support for Async Transitions, known as **Actions**, handling pending states, errors, optimistic updates, and sequential submissions automatically.

## 1. `useActionState`
`useActionState` replaces complex manual useState + try/catch combinations for forms and asynchronous mutations:

```jsx
import { useActionState } from "react";

async function updateProfile(previousState, formData) {
  const name = formData.get("name");
  try {
    const updatedUser = await api.saveUser({ name });
    return { success: true, user: updatedUser, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function ProfileForm() {
  const [state, formAction, isPending] = useActionState(updateProfile, { user: null, error: null });

  return (
    <form action={formAction}>
      <input name="name" disabled={isPending} />
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Profile"}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

## 2. `useOptimistic`
Provides instant visual feedback to users while background mutations complete:

```jsx
import { useOptimistic } from "react";

export function MessageList({ messages, sendMessage }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMsg) => [...state, { text: newMsg, sending: true }]
  );

  async function handleSend(formData) {
    const text = formData.get("text");
    addOptimisticMessage(text);
    await sendMessage(text);
  }

  return (
    <div>
      {optimisticMessages.map((m, i) => (
        <div key={i} style={{ opacity: m.sending ? 0.6 : 1 }}>{m.text}</div>
      ))}
      <form action={handleSend}><input name="text" /><button>Send</button></form>
    </div>
  );
}
```
