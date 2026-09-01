import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  adminChatConversationSchema,
  adminChatDetailSchema,
  adminChatMessageSchema,
  markAdminChatReadSchema,
  openAdminChatResultSchema,
  type AdminChatConversation,
  type AdminChatDetail,
  type AdminChatMessage,
  type OpenAdminChatResult,
} from "@/types/admin-chat";

function extractRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.conversations)) return record.conversations;
  if (Array.isArray(record.data)) return record.data;
  if (record.id != null) return [record];
  return [];
}

function parseConversation(row: unknown): AdminChatConversation | null {
  const parsed = adminChatConversationSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function parseMessage(row: unknown): AdminChatMessage | null {
  const parsed = adminChatMessageSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function parseDetail(data: unknown): AdminChatDetail {
  const nested = adminChatDetailSchema.safeParse(data);
  if (nested.success) return nested.data;

  // Some backends may return the conversation at the root with messages beside it.
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const conversation = parseConversation(record.conversation ?? record);
    if (conversation) {
      const messages = extractRows(record.messages ?? [])
        .map(parseMessage)
        .filter((row): row is AdminChatMessage => row != null);
      return { conversation, messages };
    }
  }

  throw new Error("Invalid admin chat detail");
}

function messagesPath(conversationId: string, limit?: number, before?: string) {
  const base = API_ENDPOINTS.agents.adminChatMessages(conversationId);
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (before) params.set("before", before);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export const adminChatsApi = {
  async list(): Promise<AdminChatConversation[]> {
    const data = await apiRequest(API_ENDPOINTS.agents.adminChats, {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    return extractRows(data)
      .map(parseConversation)
      .filter((row): row is AdminChatConversation => row != null)
      .sort((a, b) => {
        const aAt = a.lastMessageAt ?? a.updatedAt ?? a.createdAt;
        const bAt = b.lastMessageAt ?? b.updatedAt ?? b.createdAt;
        return new Date(bAt).getTime() - new Date(aAt).getTime();
      });
  },

  async open(input: {
    subject?: string;
    message?: string;
  } = {}): Promise<OpenAdminChatResult> {
    const body: Record<string, string> = {};
    const subject = input.subject?.trim();
    const message = input.message?.trim();
    if (subject) body.subject = subject;
    if (message) body.message = message;

    const data = await apiRequest(API_ENDPOINTS.agents.adminChats, {
      method: "POST",
      body,
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });

    const parsed = openAdminChatResultSchema.safeParse(data);
    if (parsed.success) return parsed.data;

    const conversation = parseConversation(
      data && typeof data === "object" && "conversation" in data
        ? (data as { conversation: unknown }).conversation
        : data,
    );
    if (!conversation) throw new Error("Invalid open admin chat response");

    const messageRow =
      data && typeof data === "object" && "message" in data
        ? parseMessage((data as { message: unknown }).message)
        : null;

    return {
      conversation,
      message: messageRow,
      created:
        data && typeof data === "object" && "created" in data
          ? Boolean((data as { created: unknown }).created)
          : undefined,
    };
  },

  async get(conversationId: string): Promise<AdminChatDetail> {
    const data = await apiRequest(API_ENDPOINTS.agents.adminChat(conversationId), {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    return parseDetail(data);
  },

  async listMessages(
    conversationId: string,
    opts: { limit?: number; before?: string } = {},
  ): Promise<AdminChatMessage[]> {
    const data = await apiRequest(
      messagesPath(conversationId, opts.limit, opts.before),
      {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      },
    );
    return extractRows(data)
      .map(parseMessage)
      .filter((row): row is AdminChatMessage => row != null);
  },

  async send(
    conversationId: string,
    content: string,
  ): Promise<AdminChatMessage> {
    const text = content.trim();
    const data = await apiRequest(
      API_ENDPOINTS.agents.adminChatMessages(conversationId),
      {
        method: "POST",
        body: { content: text },
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    const message = parseMessage(data);
    if (message) return message;
    return {
      id: `local-${Date.now()}`,
      conversationId,
      sender: "AGENT",
      senderId: null,
      content: text,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
  },

  async markRead(conversationId: string): Promise<void> {
    await apiRequest(API_ENDPOINTS.agents.adminChatRead(conversationId), {
      method: "POST",
      schema: markAdminChatReadSchema.or(z.unknown()),
      looseEnvelope: true,
      dedupe: false,
    });
  },
};
