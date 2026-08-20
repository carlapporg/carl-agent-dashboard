/**
 * Legacy realtime event shapes.
 * Prefer `@/types/websocket` for the native WebSocket protocol.
 * Kept so existing imports keep compiling.
 */

import { z } from "zod";

export const realtimeEventTypeSchema = z.enum([
  "task.created",
  "task.updated",
  "task.assigned",
  "task.status_changed",
  "task.completed",
  "approval.requested",
  "approval.resolved",
  "agent.assigned",
  "message.created",
]);

export const realtimeEventSchema = z.object({
  id: z.string(),
  type: realtimeEventTypeSchema,
  taskId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export type RealtimeEventType = z.infer<typeof realtimeEventTypeSchema>;
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/** Map a WS envelope into the legacy RealtimeEvent shape. */
export function wsEnvelopeToRealtimeEvent(envelope: {
  id: string;
  type: string;
  taskId?: string;
  payload: Record<string, unknown>;
  ts: string;
}): RealtimeEvent | null {
  const parsed = realtimeEventTypeSchema.safeParse(envelope.type);
  if (!parsed.success) return null;
  return {
    id: envelope.id,
    type: parsed.data,
    taskId: envelope.taskId,
    payload: envelope.payload,
    createdAt: envelope.ts,
  };
}
