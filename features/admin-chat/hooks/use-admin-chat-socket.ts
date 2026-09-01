"use client";

import { useEffect, useRef } from "react";
import { useOps } from "@/features/ops/ops-provider";
import {
  getAgentSocket,
  joinAgentAdminRoom,
} from "@/lib/realtime/agent-socket";
import {
  parseAdminChatConversationPayload,
  parseAdminChatMessagePayload,
} from "@/lib/realtime/parse-admin-chat";
import type {
  AdminChatConversation,
  AdminChatMessage,
} from "@/types/admin-chat";

type UseAdminChatSocketOptions = {
  conversationId: string | null;
  onMessage: (message: AdminChatMessage) => void;
  onConversationUpdated: (conversation: AdminChatConversation) => void;
};

/**
 * Listens on the shared agent Socket.IO connection.
 * - agentAdmin.conversation_updated → inbox
 * - agentAdmin.message → open thread
 * - joinAgentAdmin when a thread is open (re-joins on reconnect)
 */
export function useAdminChatSocket({
  conversationId,
  onMessage,
  onConversationUpdated,
}: UseAdminChatSocketOptions) {
  const ops = useOps();
  const connected = ops?.connected ?? false;
  const onMessageRef = useRef(onMessage);
  const onConversationUpdatedRef = useRef(onConversationUpdated);
  onMessageRef.current = onMessage;
  onConversationUpdatedRef.current = onConversationUpdated;

  useEffect(() => {
    const socket = getAgentSocket();
    if (!socket) return;

    function onMsg(payload: unknown) {
      const message = parseAdminChatMessagePayload(payload);
      if (message) onMessageRef.current(message);
    }

    function onUpdated(payload: unknown) {
      const conversation = parseAdminChatConversationPayload(payload);
      if (conversation) onConversationUpdatedRef.current(conversation);
    }

    socket.on("agentAdmin.message", onMsg);
    socket.on("agentAdmin_message", onMsg);
    socket.on("agentAdmin.conversation_updated", onUpdated);
    socket.on("agentAdmin_conversation_updated", onUpdated);

    return () => {
      socket.off("agentAdmin.message", onMsg);
      socket.off("agentAdmin_message", onMsg);
      socket.off("agentAdmin.conversation_updated", onUpdated);
      socket.off("agentAdmin_conversation_updated", onUpdated);
    };
  }, [connected]);

  useEffect(() => {
    if (!conversationId || !connected) return;
    const socket = getAgentSocket();
    if (!socket) return;

    joinAgentAdminRoom(socket, conversationId);

    function onConnect() {
      const live = getAgentSocket();
      if (live && conversationId) joinAgentAdminRoom(live, conversationId);
    }

    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [conversationId, connected]);
}
