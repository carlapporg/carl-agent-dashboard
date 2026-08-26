import { z } from "zod";

export const timelineEventKindSchema = z.enum([
  "status_change",
  "agent_note",
  "customer_message",
  "agent_message",
  "approval_requested",
  "approval_result",
  "receipt_uploaded",
  "system",
]);

export const chatMediaKindSchema = z.enum(["text", "voice", "image"]);

export const timelineEventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  kind: timelineEventKindSchema,
  body: z.string(),
  authorName: z.string().optional(),
  createdAt: z.string(),
  visibleToCustomer: z.boolean().default(false),
  mediaKind: chatMediaKindSchema.optional(),
  durationMs: z.number().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  previewUrl: z.string().nullable().optional(),
});

export type TimelineEventKind = z.infer<typeof timelineEventKindSchema>;
export type ChatMediaKind = z.infer<typeof chatMediaKindSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
