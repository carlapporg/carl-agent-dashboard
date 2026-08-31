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
 *   "channel": "optional-channel",
 *   "payload": { }
 * }
 *
 * Transport: browser WebSocket only (not Socket.IO).
 * After REST mutations, Backend must push the same facts to:
 *   - Agent Dashboard (this client)
 *   - Client mobile app
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
 * Subscribe channel: `queue` (or `agent:{agentId}:queue`).
 * Powers: Overview preview, /tasks live board, missed-task toasts.
 */
export const wsTaskQueueEventTypeSchema = z.enum([
  "task.created",
  "task.updated",
  "task.assigned",
  "task.status_changed",
  "task.completed",
  "task.cancelled",
  /** Offer / SLA expired or reassigned away — informational toast */
  "task.missed",
  "queue.updated",
  "task.confirmation_confirmed",
  "task.confirmation_declined",
  "task.receipt_accepted",
  "task.receipt_rejected",
]);

/**
 * Task-scoped messaging & progress (no personal PII on either side).
 * Subscribe channel: `task.messages` + taskId
 *
 * Payload authors: "agent" | "customer" | "system" only.
 */
export const wsTaskMessageEventTypeSchema = z.enum([
  "message.created",
  "message.read",
  /** Client → server: send a task chat message */
  "message.send",
  /** Q&A / clarification */
  "task.clarification_requested",
  "task.clarification_answered",
  "task.started",
  "task.in_progress",
  "task.progress_updated",
  "task.waiting_for_customer",
  "task.waiting_for_payment",
  "task.completed",
]);

/**
 * Payment realtime (task-scoped and/or agent.payments channel).
 * After POST payment-request, Backend notifies client app; client decision
 * comes back as payment.approved | payment.declined (pushed to agent).
 */
export const wsPaymentEventTypeSchema = z.enum([
  "payment.requested",
  "payment.approved",
  "payment.declined",
  "payment.expired",
  "payment.charged",
  "payment.card_issued",
  "payment.receipt_uploaded",
]);

/**
 * Alerts / notifications for Overview strip + /notifications.
 * Subscribe: `agent.alerts` (recommended) or fan out on ready queue channel.
 */
export const wsAlertEventTypeSchema = z.enum([
  "alert.created",
  "alert.resolved",
  "notification.created",
]);

/** Agent presence / availability */
export const wsAgentEventTypeSchema = z.enum([
  /** Client → server: optional mirror of PATCH availability */
  "agent.availability",
  /** Server → client: idle timeout / admin force */
  "agent.forced_offline",
]);

export const wsEventTypeSchema = z.union([
  wsControlEventTypeSchema,
  wsTaskQueueEventTypeSchema,
  wsTaskMessageEventTypeSchema,
  wsPaymentEventTypeSchema,
  wsAlertEventTypeSchema,
  wsAgentEventTypeSchema,
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
export type WsPaymentEventType = z.infer<typeof wsPaymentEventTypeSchema>;
export type WsAlertEventType = z.infer<typeof wsAlertEventTypeSchema>;
export type WsAgentEventType = z.infer<typeof wsAgentEventTypeSchema>;
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
    | "answer"
    | "status"
    | "clarification"
    | "progress"
    | "system";
  createdAt: string;
};

export type TaskQueuePayload = {
  taskId: string;
  number?: number;
  status?: string;
  priority?: string;
  title?: string;
  summary?: string;
  taskType?: string;
  tier?: string;
  expiresAt?: string;
  /** Opaque customer label only — never email/phone/legal name. */
  customerLabel?: string;
  updatedAt?: string;
};

export type PaymentEventPayload = {
  authorizationId: string;
  taskId: string;
  status: "pending" | "approved" | "declined" | "expired" | "spent";
  amount?: number;
  approvedAmount?: number;
  remaining?: number;
  merchant?: string;
  /** Masked only — last4 + network after approve */
  cardLast4?: string;
  cardNetwork?: string;
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
  | { channel: "task.messages"; taskId: string }
  | { channel: "agent.alerts" }
  | { channel: "agent.payments" };

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

export function isPaymentEvent(type: string): boolean {
  return wsPaymentEventTypeSchema.safeParse(type).success;
}

export function isAlertEvent(type: string): boolean {
  return wsAlertEventTypeSchema.safeParse(type).success;
}
