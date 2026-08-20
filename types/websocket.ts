/**
 * Native WebSocket protocol for the Agent Dashboard.
 *
 * Envelope (JSON text frames only):
 * {
 *   "v": 1,
 *   "id": "evt_...",
 *   "type": "task.created" | ...,
 *   "ts": "2026-08-21T00:00:00.000Z",
 *   "taskId": "optional-task-uuid",
 *   "payload": { }
 * }
 *
 * Backend is not live yet — event names and payloads are placeholders.
 */

import { z } from "zod";

export const WS_PROTOCOL_VERSION = 1 as const;

/** Connection + control events (client ↔ server) */
export const wsControlEventTypeSchema = z.enum([
  /** Client → server: authenticate after open (preferred over long-lived token in URL). */
  "auth",
  /** Server → client: auth accepted. */
  "auth.ok",
  /** Server → client: auth rejected; connection should close. */
  "auth.error",
  /** Bidirectional keepalive. */
  "ping",
  "pong",
  /** Server → client: generic error for a prior message. */
  "error",
  /** Client → server: join a room / channel. */
  "subscribe",
  /** Client → server: leave a room / channel. */
  "unsubscribe",
  /** Server → client: subscription confirmed. */
  "subscribed",
]);

/**
 * Task queue realtime events.
 * Subscribe channel: `queue` or `agent:{agentId}:queue`
 */
export const wsTaskQueueEventTypeSchema = z.enum([
  "task.created",
  "task.updated",
  "task.assigned",
  "task.status_changed",
  "task.completed",
  "task.cancelled",
]);

/**
 * Task-scoped messaging (no personal PII on either side).
 * Subscribe channel: `task:{taskId}:messages`
 *
 * Payload authors should be role labels only, e.g. "agent" | "customer" | "system",
 * never real names, emails, or profile fields.
 */
export const wsTaskMessageEventTypeSchema = z.enum([
  "message.created",
  "message.read",
  /** Client → server: send a task chat message */
  "message.send",
  "task.started",
  "task.in_progress",
  "task.clarification_requested",
  "task.progress_updated",
  "task.completed",
]);

export const wsEventTypeSchema = z.union([
  wsControlEventTypeSchema,
  wsTaskQueueEventTypeSchema,
  wsTaskMessageEventTypeSchema,
]);

export const wsEnvelopeSchema = z.object({
  v: z.literal(WS_PROTOCOL_VERSION).default(WS_PROTOCOL_VERSION),
  id: z.string().min(1),
  type: z.string().min(1),
  ts: z.string().min(1),
  taskId: z.string().optional(),
  channel: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type WsControlEventType = z.infer<typeof wsControlEventTypeSchema>;
export type WsTaskQueueEventType = z.infer<typeof wsTaskQueueEventTypeSchema>;
export type WsTaskMessageEventType = z.infer<typeof wsTaskMessageEventTypeSchema>;
export type WsEventType = z.infer<typeof wsEventTypeSchema> | string;
export type WsEnvelope = z.infer<typeof wsEnvelopeSchema>;

/** Anonymous participant for task chat — never attach PII here. */
export type TaskChatParticipantRole = "agent" | "customer" | "system";

export type TaskChatMessagePayload = {
  messageId: string;
  body: string;
  from: TaskChatParticipantRole;
  kind?:
    | "question"
    | "status"
    | "clarification"
    | "progress"
    | "system";
  createdAt: string;
};

export type TaskQueuePayload = {
  taskId: string;
  status?: string;
  priority?: string;
  title?: string;
  /** Opaque customer label only — never email/phone/name from profile APIs. */
  customerLabel?: string;
  updatedAt?: string;
};

export type WsConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "authenticating"
  | "ready"
  | "reconnecting"
  | "closed"
  | "error";

export type WsSubscribeTarget =
  | { channel: "queue" }
  | { channel: "task.messages"; taskId: string };

export function createClientEnvelope(
  type: string,
  payload: Record<string, unknown> = {},
  extras: { taskId?: string; channel?: string } = {},
): WsEnvelope {
  return {
    v: WS_PROTOCOL_VERSION,
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    ts: new Date().toISOString(),
    taskId: extras.taskId,
    channel: extras.channel,
    payload,
  };
}

export function parseWsEnvelope(raw: string): WsEnvelope | null {
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = wsEnvelopeSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isTaskQueueEvent(type: string): boolean {
  return wsTaskQueueEventTypeSchema.safeParse(type).success;
}

export function isTaskMessageEvent(type: string): boolean {
  return wsTaskMessageEventTypeSchema.safeParse(type).success;
}
