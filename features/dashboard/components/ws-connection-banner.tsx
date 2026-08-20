"use client";

import { useWebSocketOptional } from "@/components/providers/websocket-provider";
import { cn } from "@/lib/utils/cn";

export function WsConnectionBanner() {
  const ws = useWebSocketOptional();
  if (!ws?.configured) return null;

  const state = ws.connectionState;
  if (state === "ready" || state === "open" || state === "idle") return null;

  const message =
    state === "reconnecting" || state === "connecting"
      ? "Reconnecting to live updates…"
      : state === "authenticating"
        ? "Securing live connection…"
        : state === "error"
          ? "Live connection issue — queue may be stale."
          : "Live connection unavailable.";

  return (
    <div
      className={cn(
        "mb-4 rounded-lg border px-3 py-2 text-sm",
        state === "error"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-border bg-surface-hover text-foreground-soft",
      )}
      role="status"
    >
      {message}
    </div>
  );
}
