import {
  adminChatConversationSchema,
  adminChatMessageSchema,
  type AdminChatConversation,
  type AdminChatMessage,
} from "@/types/admin-chat";

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.data && typeof root.data === "object") {
    return root.data as Record<string, unknown>;
  }
  return root;
}

export function parseAdminChatMessagePayload(
  payload: unknown,
): AdminChatMessage | null {
  const data = asRecord(payload);
  if (!data) return null;

  const candidates = [
    data.message,
    data,
    data.data,
  ];

  for (const candidate of candidates) {
    const parsed = adminChatMessageSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return null;
}

export function parseAdminChatConversationPayload(
  payload: unknown,
): AdminChatConversation | null {
  const data = asRecord(payload);
  if (!data) return null;

  const candidates = [
    data.conversation,
    data,
    data.data,
  ];

  for (const candidate of candidates) {
    const parsed = adminChatConversationSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return null;
}
