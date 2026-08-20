"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  WebSocketConnectionManager,
  isWebSocketConfigured,
} from "@/lib/websocket";
import type { WsConnectionState, WsEnvelope } from "@/types/websocket";

type WebSocketContextValue = {
  /** True when NEXT_PUBLIC_WS_URL (or API base) can resolve a WS URL. */
  configured: boolean;
  connectionState: WsConnectionState;
  isConnected: boolean;
  manager: WebSocketConnectionManager | null;
  connect: () => void;
  disconnect: () => void;
  /**
   * Subscribe to event type(s). Pass a string or array.
   * Handler is cleaned up on unmount / dependency change.
   */
  subscribe: (
    type: string | string[],
    handler: (event: WsEnvelope) => void,
  ) => () => void;
  send: (
    type: string,
    payload?: Record<string, unknown>,
    extras?: { taskId?: string; channel?: string },
  ) => boolean;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

type WebSocketProviderProps = {
  children: ReactNode;
  /**
   * When false, manager is created but does not connect.
   * Dashboard layout should pass true after auth.
   */
  enabled?: boolean;
  /**
   * Optional token provider for the `auth` frame.
   * Until backend issues a WS ticket, leave undefined.
   */
  getAccessToken?: () => Promise<string | null> | string | null;
};

export function WebSocketProvider({
  children,
  enabled = true,
  getAccessToken,
}: WebSocketProviderProps) {
  const configured = isWebSocketConfigured();
  const [connectionState, setConnectionState] =
    useState<WsConnectionState>("idle");
  const managerRef = useRef<WebSocketConnectionManager | null>(null);

  const manager = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!configured) return null;

    const instance = new WebSocketConnectionManager({
      getAccessToken,
      onStateChange: setConnectionState,
    });
    managerRef.current = instance;
    return instance;
    // getAccessToken identity: callers should stabilize with useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  useEffect(() => {
    if (!manager || !enabled) return;

    void manager.connect();

    return () => {
      manager.disconnect();
    };
  }, [manager, enabled]);

  const connect = useCallback(() => {
    void managerRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  const subscribe = useCallback(
    (type: string | string[], handler: (event: WsEnvelope) => void) => {
      const m = managerRef.current;
      if (!m) return () => {};

      const types = Array.isArray(type) ? type : [type];
      const unsubs = types.map((t) => m.on(t, handler));
      return () => {
        for (const unsub of unsubs) unsub();
      };
    },
    [],
  );

  const send = useCallback(
    (
      type: string,
      payload: Record<string, unknown> = {},
      extras?: { taskId?: string; channel?: string },
    ) => {
      return managerRef.current?.emit(type, payload, extras) ?? false;
    },
    [],
  );

  const value = useMemo<WebSocketContextValue>(
    () => ({
      configured,
      connectionState,
      isConnected:
        connectionState === "ready" || connectionState === "open",
      manager,
      connect,
      disconnect,
      subscribe,
      send,
    }),
    [
      configured,
      connectionState,
      manager,
      connect,
      disconnect,
      subscribe,
      send,
    ],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return ctx;
}

/** Safe variant for optional usage outside the provider (returns null). */
export function useWebSocketOptional(): WebSocketContextValue | null {
  return useContext(WebSocketContext);
}
