"use client";

import { useEffect, useState, useTransition } from "react";
import { useWebSocketOptional } from "@/components/providers/websocket-provider";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  dashboardApi,
  readLocalAvailability,
  writeLocalAvailability,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils/cn";
import type { AgentAvailability } from "@/types/dashboard";

const OPTIONS: AgentAvailability[] = ["online", "busy", "offline"];

type AvailabilityToggleProps = {
  activeTaskCount?: number;
  compact?: boolean;
};

export function AvailabilityToggle({
  activeTaskCount,
  compact = false,
}: AvailabilityToggleProps) {
  const ws = useWebSocketOptional();
  const [status, setStatus] = useState<AgentAvailability>("online");
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [pending, startTransition] = useTransition();
  const [count, setCount] = useState(activeTaskCount ?? 0);

  useEffect(() => {
    setStatus(readLocalAvailability());
    if (activeTaskCount == null) {
      setCount(dashboardApi.countActiveTasks());
    }
  }, [activeTaskCount]);

  function apply(next: AgentAvailability) {
    startTransition(() => {
      setStatus(next);
      writeLocalAvailability(next);
      // Future: PATCH /agents/me/availability + WS agent.availability
      ws?.send("agent.availability", { status: next });
    });
  }

  function onSelect(next: AgentAvailability) {
    if (next === status || pending) return;
    if (next === "offline" && count > 0) {
      setConfirmOffline(true);
      return;
    }
    apply(next);
  }

  return (
    <>
      <div
        className={cn(
          "inline-flex rounded-full border border-border bg-surface p-0.5",
          compact ? "text-xs" : "text-sm",
        )}
        role="group"
        aria-label="Availability"
      >
        {OPTIONS.map((option) => {
          const active = status === option;
          return (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => onSelect(option)}
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold capitalize transition-colors",
                active
                  ? option === "online"
                    ? "bg-emerald-500 text-white"
                    : option === "busy"
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-white"
                  : "text-muted hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmOffline}
        onClose={() => setConfirmOffline(false)}
        title="Go offline?"
        description={`Aapke paas ${count} active task${count === 1 ? "" : "s"} hain. Kya sach mein offline jaana hai? Queue matching ruk jayega.`}
        confirmLabel="Go offline"
        cancelLabel="Stay available"
        destructive
        onConfirm={() => {
          setConfirmOffline(false);
          apply("offline");
        }}
      />
    </>
  );
}
