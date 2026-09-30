import { z } from "zod";

export const adminChatStatusSchema = z.enum(["OPEN", "CLOSED"]);

export const adminChatSenderSchema = z.enum(["ADMIN", "AGENT", "SYSTEM"]);

export const adminChatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  sender: adminChatSenderSchema,
  senderId: z.string().nullable().optional(),
  content: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  messageType: z
    .string()
    .nullish()
    .transform((value) => {
      const kind = (value ?? "TEXT").toUpperCase();
      if (kind === "IMAGE" || kind === "FILE" || kind === "TEXT") return kind;
      return "TEXT" as const;
    }),
  fileName: z.string().nullish(),
  fileUrl: z.string().nullish(),
  imageUrl: z.string().nullish(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const adminChatConversationSchema = z.object({
  id: z.string(),
  agentId: z.string().optional(),
  status: adminChatStatusSchema,
  subject: z.string().nullable().optional(),
  lastMessageAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  closedAt: z.string().nullable().optional(),
  /** Present on some payloads; agent list may omit. */
  unreadCount: z.number().optional(),
});

export const adminChatDetailSchema = z.object({
  conversation: adminChatConversationSchema,
  messages: z.array(adminChatMessageSchema).default([]),
});

export const openAdminChatResultSchema = z.object({
  conversation: adminChatConversationSchema,
  message: adminChatMessageSchema.nullable().optional(),
  created: z.boolean().optional(),
});

export const markAdminChatReadSchema = z.object({
  ok: z.boolean().optional(),
  readAt: z.string().nullable().optional(),
});

export type AdminChatStatus = z.infer<typeof adminChatStatusSchema>;
export type AdminChatMessageType = "TEXT" | "IMAGE" | "FILE";
export type AdminChatSender = z.infer<typeof adminChatSenderSchema>;
export type AdminChatMessage = z.infer<typeof adminChatMessageSchema>;
export type AdminChatConversation = z.infer<typeof adminChatConversationSchema>;
export type AdminChatDetail = z.infer<typeof adminChatDetailSchema>;
export type OpenAdminChatResult = z.infer<typeof openAdminChatResultSchema>;
