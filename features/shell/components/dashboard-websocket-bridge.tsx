"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WebSocketProvider } from "@/components/providers/websocket-provider";

type DashboardWebSocketBridgeProps = {
  children: ReactNode;
};

/**
 * Client bridge so the server dashboard layout can mount WebSocketProvider.
 * Token wiring: add getAccessToken when backend exposes a WS ticket endpoint.
 */
export function DashboardWebSocketBridge({
  children,
}: DashboardWebSocketBridgeProps) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Pause reconnect storms when the tab is hidden (optional nicety).
    function onVisibility() {
      setEnabled(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <WebSocketProvider enabled={enabled}>{children}</WebSocketProvider>
  );
}
