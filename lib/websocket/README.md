# Native WebSocket architecture (Agent Dashboard)

This app uses the **browser `WebSocket` API only**. Do **not** add Socket.IO or similar libraries.

Backend is not live yet. This folder is the frontend contract so wiring later is mostly “set URL + map events”.

---

## Files

| Path | Role |
|------|------|
| `types/websocket.ts` | Envelope schema, event names, chat/queue payload shapes |
| `lib/websocket/url.ts` | Builds `ws://` / `wss://` URL from env |
| `lib/websocket/connection-manager.ts` | Connect, reconnect, heartbeat, pub/sub handlers |
| `lib/websocket/index.ts` | Public exports |
| `components/providers/websocket-provider.tsx` | React context |
| `hooks/use-task-queue-socket.ts` | Queue realtime hook |
| `hooks/use-task-chat-socket.ts` | Task-scoped chat hook |
| `hooks/use-realtime.ts` | Legacy-compatible bridge → WS envelopes |
| `features/shell/components/dashboard-websocket-bridge.tsx` | Mounts provider inside authenticated dashboard |

Provider is mounted from `app/(dashboard)/layout.tsx` (logged-in agents only).

---

## How the frontend connects

1. Set env (client-visible):

```bash
NEXT_PUBLIC_WS_URL=wss://YOUR-API-HOST/ws
```

If unset, the client derives `wss://YOUR-API-HOST/ws` from `NEXT_PUBLIC_API_BASE_URL` / `API_BASE_URL` (strips `/api/v1`).

2. After login, `DashboardWebSocketBridge` → `WebSocketProvider` calls `manager.connect()`.
3. Browser opens a native WebSocket to that URL.
4. On `open`, if `getAccessToken` is provided, client sends an `auth` frame (see below).
5. Exponential backoff reconnect runs on unexpected close (heartbeat via `ping` / `pong`).

Until `NEXT_PUBLIC_WS_URL` (or API base) is set, `configured === false` and no socket is opened.

---

## Authentication (when backend is ready)

Access tokens today live in an **httpOnly** cookie, so the browser JS cannot read them for a query string.

**Recommended (matches current client code):**

1. Client connects to `wss://…/ws` (no long-lived JWT in the URL).
2. Immediately after `open`, client sends:

```json
{
  "v": 1,
  "id": "c_…",
  "type": "auth",
  "ts": "2026-08-21T00:00:00.000Z",
  "payload": { "token": "<accessToken or short-lived WS ticket>" }
}
```

3. Server replies `auth.ok` or `auth.error`.
4. Wire token into the provider:

```tsx
<WebSocketProvider
  enabled
  getAccessToken={async () => {
    // Prefer a short-lived ticket from e.g. POST /api/v1/auth/ws-ticket
    return ticket;
  }}
>
```

**Alternative:** same-site cookie auth on the WS upgrade handshake (server reads session cookie). Then omit `getAccessToken`; server treats the connection as authenticated on open and should still emit `auth.ok` (or the client can stay on `ready` without a token).

---

## Message protocol

Every frame is a **JSON text** message:

```ts
{
  v: 1;                    // protocol version
  id: string;              // unique event id
  type: string;            // event name
  ts: string;              // ISO timestamp
  taskId?: string;         // required for task chat / task-scoped events
  channel?: string;        // e.g. "queue" | "task.messages"
  payload: Record<string, unknown>;
}
```

### Control

| Type | Direction | Purpose |
|------|-----------|---------|
| `auth` | C→S | Authenticate |
| `auth.ok` / `auth.error` | S→C | Auth result |
| `ping` / `pong` | both | Keepalive |
| `subscribe` / `unsubscribe` | C→S | Join/leave channel |
| `subscribed` | S→C | Ack |
| `error` | S→C | Error for a prior message |

### Task queue

Subscribe: `{ type: "subscribe", channel: "queue" }`

| Type | Meaning |
|------|---------|
| `task.created` | New task in queue |
| `task.updated` | Fields changed |
| `task.assigned` | Assigned to an agent |
| `task.status_changed` | Status transition |
| `task.completed` / `task.cancelled` | Terminal |

Payload placeholder: `{ taskId, status?, priority?, title?, customerLabel?, updatedAt? }`  
Use `customerLabel` only — **no** email / phone / real name from profile APIs.

### Task messaging (privacy)

Subscribe: `{ type: "subscribe", channel: "task.messages", taskId }`

| Type | Direction | Meaning |
|------|-----------|---------|
| `message.send` | C→S | Agent sends chat line |
| `message.created` | S→C | New chat line (broadcast) |
| `message.read` | both | Read receipt (optional) |
| `task.started` | both | Status |
| `task.in_progress` | both | Status |
| `task.clarification_requested` | both | Ask for info |
| `task.progress_updated` | both | Progress note |
| `task.completed` | both | Done |

Chat payload:

```json
{
  "messageId": "…",
  "body": "Need the hotel confirmation number",
  "from": "agent",
  "kind": "question",
  "createdAt": "…"
}
```

`from` must be `"agent" | "customer" | "system"` only — **never** personal names or profile fields on either side.

---

## How to send / receive / subscribe (frontend)

### Receive (any event)

```tsx
import { useWebSocket } from "@/hooks";

function Example() {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    return subscribe("task.created", (event) => {
      console.log(event.payload);
    });
  }, [subscribe]);
}
```

`subscribe("*", handler)` receives every envelope.

### Queue helper

```tsx
import { useTaskQueueSocket } from "@/hooks";

const { events, isConnected } = useTaskQueueSocket({
  onEvent: (e) => {
    // invalidate React Query tasks list, prepend to live queue, toast, etc.
  },
});
```

### Task chat helper

```tsx
import { useTaskChatSocket } from "@/hooks";

const { messages, sendMessage, sendStatus } = useTaskChatSocket({
  taskId: task.id,
});

sendMessage("Can you confirm the pickup time?");
sendStatus("task.in_progress", "Heading to the pharmacy");
```

### Low-level send

```tsx
const { send } = useWebSocket();
send("message.send", { body: "…", from: "agent" }, { taskId, channel: "task.messages" });
```

---

## Where to add new event handlers

1. **Add the event name** in `types/websocket.ts` (`wsTaskQueueEventTypeSchema` or `wsTaskMessageEventTypeSchema`).
2. **Handle in UI** via:
   - `useWebSocket().subscribe("your.event", …)`, or
   - extend `useTaskQueueSocket` / `useTaskChatSocket`, or
   - a feature-specific hook under `features/…/hooks`.
3. Prefer updating React Query caches (`queryKeys.tasks…`) inside handlers instead of full page reloads.
4. Do **not** put business logic inside `WebSocketConnectionManager` — keep it transport-only.

---

## Backend integration checklist

When the server is ready:

1. Expose a native WS endpoint (e.g. `/ws`) — **not** Socket.IO.
2. Accept JSON envelopes with `v`, `id`, `type`, `ts`, `payload`.
3. Authenticate via first `auth` message and/or cookie on upgrade.
4. Implement `subscribe` rooms: `queue`, `task.messages` (+ `taskId`).
5. Push queue events to agents who should see them.
6. Push task chat only to participants of that `taskId`, with **role-only** author metadata.
7. Reply to `ping` with `pong`; emit `auth.ok` after successful auth.
8. Set `NEXT_PUBLIC_WS_URL` in staging/production env.
9. Optionally add `POST /api/v1/auth/ws-ticket` and pass it through `getAccessToken`.

---

## Out of scope (for now)

- Live UI wiring of `LiveTaskQueue` / inbox (hooks are ready; call them when backend events exist).
- Socket.IO, ws npm client libraries, or server-side WS in this Next app.
