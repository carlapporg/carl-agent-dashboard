"use client";

import { useEffect, useState } from "react";
import { useWebSocketOptional } from "@/components/providers/websocket-provider";
import {
  isTaskQueueEvent,
  type WsEnvelope,
  type WsTaskQueueEventType,
} from "@/types/websocket";

type UseTaskQueueSocketOptions = {
  /** When true (default), also sends subscribe { channel: "queue" } once ready. */
  autoSubscribe?: boolean;
  onEvent?: (event: WsEnvelope) => void;
};

/**
 * Real-time task queue events (task.created, task.updated, …).
 * Wire this into LiveTaskQueue / TaskList when the backend WS is live.
 */
export function useTaskQueueSocket(options: UseTaskQueueSocketOptions = {}) {
  const { autoSubscribe = true, onEvent } = options;
  const ws = useWebSocketOptional();
  const [events, setEvents] = useState<WsEnvelope[]>([]);

  useEffect(() => {
    if (!ws?.manager) return;

    const unsub = ws.subscribe("*", (event) => {
      if (!isTaskQueueEvent(event.type)) return;
      setEvents((prev) => [event, ...prev].slice(0, 50));
      onEvent?.(event);
    });

    return unsub;
  }, [ws, onEvent]);

  useEffect(() => {
    if (!ws?.manager || !autoSubscribe) return;
    if (ws.connectionState !== "ready" && !ws.isConnected) return;
    ws.manager.subscribe({ channel: "queue" });
  }, [ws, autoSubscribe, ws?.isConnected, ws?.connectionState]);

  return {
    configured: ws?.configured ?? false,
    connectionState: ws?.connectionState ?? "idle",
    isConnected: ws?.isConnected ?? false,
    events,
  };
}

export type { WsTaskQueueEventType };
