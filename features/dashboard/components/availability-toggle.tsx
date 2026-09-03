"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import { setAvailabilityAction } from "@/features/agents/actions";
import { useOps } from "@/features/ops/ops-provider";
import { toUserMessage } from "@/lib/api/error-handler";
import { emitAgentAvailability } from "@/lib/realtime/agent-socket";
import {
  normalizePresence,
  presenceToUi,
  uiToPresence,
  writeManualPresence,
} from "@/lib/agent/presence";
import { cn } from "@/lib/utils/cn";
import type { AgentPresence } from "@/types/agent";
import type { AgentAvailability } from "@/types/dashboard";

const OPTIONS: Array<{
  value: AgentAvailability;
  label: string;
  color: string;
  active: string;
}> = [
  {
    value: "available",
    label: "Available",
    color: "bg-emerald-500",
    active: "bg-emerald-500 text-white",
  },
  {
    value: "busy",
    label: "Busy",
    color: "bg-amber-500",
    active: "bg-amber-500 text-white",
  },
  {
    value: "offline",
    label: "Offline",
    color: "bg-slate-500",
    active: "bg-slate-600 text-white",
  },
];

type AvailabilityToggleProps = {
  activeTaskCount?: number;
  compact?: boolean;
  presence?: AgentPresence;
};

export function AvailabilityToggle({
  activeTaskCount,
  compact = false,
  presence,
}: AvailabilityToggleProps) {
  const ops = useOps();
  const { toast } = useToast();
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const count = activeTaskCount ?? 0;

  const current = ops
    ? presenceToUi(ops.presence)
    : presenceToUi(presence ?? "AVAILABLE");

  function apply(next: AgentAvailability) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);

    const nextWrite = uiToPresence(next);

    void setAvailabilityAction(nextWrite)
      .then((row) => {
        const synced = normalizePresence(row.status);
        writeManualPresence(synced);
        ops?.setPresence(synced);
        emitAgentAvailability(synced);
      })
      .catch((error) => {
        toast(toUserMessage(error), "error");
        void ops?.syncPresenceFromBackend();
      })
      .finally(() => {
        inFlight.current = false;
        setSaving(false);
      });
  }

  function onSelect(next: AgentAvailability) {
    if (next === current || inFlight.current || saving) return;
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
        aria-busy={saving}
      >
        {OPTIONS.map((option) => {
          const active = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              title={option.label}
              onClick={() => onSelect(option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold transition-colors",
                active ? option.active : "text-muted hover:text-foreground",
                saving && "cursor-not-allowed opacity-70",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  active ? "bg-white" : option.color,
                )}
              />
              {compact ? option.label.slice(0, 3) : option.label}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmOffline}
        onClose={() => setConfirmOffline(false)}
        title="Go offline?"
        description={`You have ${count} active task${count === 1 ? "" : "s"}. Going offline stops new assignments.`}
        confirmLabel="Go offline"
        cancelLabel="Stay online"
        destructive
        onConfirm={() => {
          setConfirmOffline(false);
          apply("offline");
        }}
      />
    </>
  );
}
