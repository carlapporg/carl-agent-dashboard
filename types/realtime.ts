import { z } from "zod";

export const realtimeEventTypeSchema = z.enum([
  "task.updated",
  "task.assigned",
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
