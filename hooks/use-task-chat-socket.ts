"use client";

import { useCallback, useEffect, useState } from "react";
import { useWebSocketOptional } from "@/components/providers/websocket-provider";
import {
  isTaskMessageEvent,
  type TaskChatMessagePayload,
  type TaskChatParticipantRole,
  type WsEnvelope,
} from "@/types/websocket";

type UseTaskChatSocketOptions = {
  taskId: string | null | undefined;
  enabled?: boolean;
  onEvent?: (event: WsEnvelope) => void;
};

/**
 * Task-scoped chat over native WebSocket.
 *
 * Privacy: only send role + body — never names, emails, or profile fields.
 * Backend must enforce the same on echoed payloads.
 */
export function useTaskChatSocket(options: UseTaskChatSocketOptions) {
  const { taskId, enabled = true, onEvent } = options;
  const ws = useWebSocketOptional();
  const [messages, setMessages] = useState<WsEnvelope[]>([]);

  useEffect(() => {
    if (!ws?.manager || !enabled || !taskId) return;

    const unsub = ws.subscribe("*", (event) => {
      if (event.taskId && event.taskId !== taskId) return;
      if (!isTaskMessageEvent(event.type) && event.type !== "message.created") {
        return;
      }
      setMessages((prev) => [event, ...prev].slice(0, 100));
      onEvent?.(event);
    });

    return unsub;
  }, [ws, enabled, taskId, onEvent]);

  useEffect(() => {
    if (!ws?.manager || !enabled || !taskId) return;
    if (ws.connectionState !== "ready" && !ws.isConnected) return;

    ws.manager.subscribe({ channel: "task.messages", taskId });
    return () => {
      ws.manager?.unsubscribe({ channel: "task.messages", taskId });
    };
  }, [ws, enabled, taskId, ws?.isConnected, ws?.connectionState]);

  const sendMessage = useCallback(
    (
      body: string,
      extras?: {
        kind?: TaskChatMessagePayload["kind"];
        from?: TaskChatParticipantRole;
      },
    ) => {
      if (!taskId || !body.trim()) return false;

      const payload: Record<string, unknown> = {
        body: body.trim(),
        from: extras?.from ?? "agent",
        kind: extras?.kind ?? "question",
      };

      return (
        ws?.send("message.send", payload, {
          taskId,
          channel: "task.messages",
        }) ?? false
      );
    },
    [ws, taskId],
  );

  const sendStatus = useCallback(
    (
      type:
        | "task.started"
        | "task.in_progress"
        | "task.clarification_requested"
        | "task.progress_updated"
        | "task.completed",
      note?: string,
    ) => {
      if (!taskId) return false;
      return (
        ws?.send(
          type,
          { note: note ?? "", from: "agent" },
          { taskId, channel: "task.messages" },
        ) ?? false
      );
    },
    [ws, taskId],
  );

  return {
    configured: ws?.configured ?? false,
    connectionState: ws?.connectionState ?? "idle",
    isConnected: ws?.isConnected ?? false,
    messages,
    sendMessage,
    sendStatus,
  };
}
