"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocketOptional } from "@/components/providers/websocket-provider";
import {
  wsEnvelopeToRealtimeEvent,
  type RealtimeEvent,
} from "@/types/realtime";

type UseRealtimeOptions = {
  enabled?: boolean;
  /** @deprecated Polling is unused when WebSocket is configured. */
  pollMs?: number;
  onEvent?: (event: RealtimeEvent) => void;
};

/**
 * App-level realtime hook.
 * Uses native WebSocket when WebSocketProvider is mounted and configured;
 * otherwise stays idle (no Socket.IO).
 */
export function useRealtimeEvents(options: UseRealtimeOptions = {}) {
  const { enabled = true, onEvent } = options;
  const ws = useWebSocketOptional();
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const ingest = useCallback((next: RealtimeEvent[]) => {
    if (next.length === 0) return;
    setEvents((prev) => [...next, ...prev].slice(0, 50));
    for (const event of next) {
      onEventRef.current?.(event);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !ws?.manager) return;

    return ws.subscribe("*", (envelope) => {
      const mapped = wsEnvelopeToRealtimeEvent(envelope);
      if (mapped) ingest([mapped]);
    });
  }, [enabled, ws, ingest]);

  return {
    events,
    connected: enabled && (ws?.isConnected ?? false),
    configured: ws?.configured ?? false,
    connectionState: ws?.connectionState ?? "idle",
  };
}

export function emitMockRealtimeEvent(event: RealtimeEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RealtimeEvent>("carl:realtime", { detail: event }),
  );
}

export function useRealtimeEventBus(onEvent?: (event: RealtimeEvent) => void) {
  useEffect(() => {
    function handler(event: Event) {
      const custom = event as CustomEvent<RealtimeEvent>;
      if (custom.detail) onEvent?.(custom.detail);
    }
    window.addEventListener("carl:realtime", handler);
    return () => window.removeEventListener("carl:realtime", handler);
  }, [onEvent]);
}
