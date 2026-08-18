"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/types/realtime";

type UseRealtimeOptions = {
  enabled?: boolean;
  pollMs?: number;
  onEvent?: (event: RealtimeEvent) => void;
};

/**
 * Placeholder realtime hook. Today it polls a local event bus mock.
 * Swap the fetcher for a WebSocket client when Backend is ready.
 */
export function useRealtimeEvents(options: UseRealtimeOptions = {}) {
  const { enabled = true, pollMs = 15000, onEvent } = options;
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
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
    if (!enabled) return;

    setConnected(true);
    let cancelled = false;

    async function tick() {
      // Future: replace with WebSocket subscription.
      // Mock bus currently has no push stream — keep connection state honest.
      if (cancelled) return;
      ingest([]);
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      setConnected(false);
    };
  }, [enabled, pollMs, ingest]);

  return { events, connected };
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
