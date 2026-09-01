"use server";

import { adminChatsApi } from "@/lib/api/admin-chats";
import { toUserMessage } from "@/lib/api/error-handler";
import type {
  AdminChatConversation,
  AdminChatDetail,
  AdminChatMessage,
  OpenAdminChatResult,
} from "@/types/admin-chat";

export type AdminChatActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function fail(error: unknown): { ok: false; message: string } {
  return { ok: false, message: toUserMessage(error) };
}

export async function listAdminChatsAction(): Promise<
  AdminChatActionResult<AdminChatConversation[]>
> {
  try {
    return { ok: true, data: await adminChatsApi.list() };
  } catch (error) {
    return fail(error);
  }
}

export async function openAdminChatAction(input?: {
  subject?: string;
  message?: string;
}): Promise<AdminChatActionResult<OpenAdminChatResult>> {
  try {
    return { ok: true, data: await adminChatsApi.open(input ?? {}) };
  } catch (error) {
    return fail(error);
  }
}

export async function getAdminChatAction(
  conversationId: string,
): Promise<AdminChatActionResult<AdminChatDetail>> {
  try {
    return { ok: true, data: await adminChatsApi.get(conversationId) };
  } catch (error) {
    return fail(error);
  }
}

export async function listAdminChatMessagesAction(
  conversationId: string,
  opts?: { limit?: number; before?: string },
): Promise<AdminChatActionResult<AdminChatMessage[]>> {
  try {
    return {
      ok: true,
      data: await adminChatsApi.listMessages(conversationId, opts),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function sendAdminChatMessageAction(
  conversationId: string,
  content: string,
): Promise<AdminChatActionResult<AdminChatMessage>> {
  try {
    return {
      ok: true,
      data: await adminChatsApi.send(conversationId, content),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function markAdminChatReadAction(
  conversationId: string,
): Promise<AdminChatActionResult<{ ok: true }>> {
  try {
    await adminChatsApi.markRead(conversationId);
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return fail(error);
  }
}
