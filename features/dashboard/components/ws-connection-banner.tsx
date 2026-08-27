"use client";

import { useEffect, useState } from "react";
import { useOps } from "@/features/ops/ops-provider";
import { cn } from "@/lib/utils/cn";

export function WsConnectionBanner() {
  const ops = useOps();
  const connected = ops?.connected ?? true;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (connected) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), 1500);
    return () => window.clearTimeout(id);
  }, [connected]);

  if (!show || connected) return null;

  return (
    <div
      className={cn(
        "mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900",
      )}
      role="status"
    >
      Live connection dropped. Reconnecting and checking the task queue so you
      do not miss an offer.
    </div>
  );
}
