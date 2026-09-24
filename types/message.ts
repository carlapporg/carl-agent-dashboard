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

export const messageReceiptStatusSchema = z.enum([
  "SENT",
  "DELIVERED",
  "SEEN",
]);

export type MessageReceiptStatus = z.infer<typeof messageReceiptStatusSchema>;

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
  /** SENT → DELIVERED → SEEN (agent outgoing ticks). */
  receiptStatus: messageReceiptStatusSchema.optional(),
  deliveredAt: z.string().nullable().optional(),
  seenAt: z.string().nullable().optional(),
  /** Legacy alias of seenAt. */
  readAt: z.string().nullable().optional(),
  /** Nest message metadata (e.g. venue_picked). */
  metadata: z.unknown().nullable().optional(),
});

export type TimelineEventKind = z.infer<typeof timelineEventKindSchema>;
export type ChatMediaKind = z.infer<typeof chatMediaKindSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
