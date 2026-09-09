"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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
  /** Short label shown on the Figma-style pill trigger */
  pillLabel: string;
  dot: string;
}> = [
  {
    value: "available",
    label: "Available",
    pillLabel: "Active",
    dot: "bg-[#27ca40]",
  },
  {
    value: "busy",
    label: "Busy",
    pillLabel: "Busy",
    dot: "bg-amber-500",
  },
  {
    value: "offline",
    label: "Offline",
    pillLabel: "Offline",
    dot: "bg-slate-500",
  },
];

type AvailabilityToggleProps = {
  activeTaskCount?: number;
  presence?: AgentPresence;
};

export function AvailabilityToggle({
  activeTaskCount,
  presence,
}: AvailabilityToggleProps) {
  const ops = useOps();
  const { toast } = useToast();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const count = activeTaskCount ?? 0;

  const current = ops
    ? presenceToUi(ops.presence)
    : presenceToUi(presence ?? "AVAILABLE");

  const currentOption =
    OPTIONS.find((option) => option.value === current) ?? OPTIONS[0]!;

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  function apply(next: AgentAvailability) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    close();

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

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  const isAvailable = current === "available";

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={saving}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`Availability: ${currentOption.label}`}
          aria-busy={saving}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "inline-flex h-[35px] items-center gap-2.5 rounded-[40px] py-0 pl-4 pr-2 text-[12px] font-medium tracking-[-0.05em] text-black",
            isAvailable
              ? "bg-[rgba(61,188,61,0.15)]"
              : current === "busy"
                ? "bg-[rgba(245,158,11,0.15)]"
                : "bg-[#f6f6f6]",
            saving && "cursor-not-allowed opacity-70",
          )}
        >
          <span>{currentOption.pillLabel}</span>
          <span
            className={cn("size-[5px] shrink-0 rounded-full", currentOption.dot)}
            aria-hidden
          />
          <span className="flex size-[29px] items-center justify-center rounded-full bg-[#fafafa]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/figma/dashboard/chevron.svg"
              alt=""
              width={15}
              height={15}
              className={cn(
                "size-[15px] transition-transform",
                open ? "-rotate-90" : "rotate-90",
              )}
            />
          </span>
        </button>

        {open ? (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Set availability"
            className="absolute right-0 z-50 mt-2 min-w-[10.5rem] rounded-[12px] border border-[#e7e7e7] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
          >
            {OPTIONS.map((option) => {
              const selected = option.value === current;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  disabled={saving}
                  onClick={() => onSelect(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[12px] font-medium tracking-[-0.02em]",
                    selected
                      ? "bg-[#f6f6f6] text-[#1f1f21]"
                      : "text-[rgba(0,0,0,0.55)] hover:bg-[#f6f6f6] hover:text-[#1f1f21]",
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", option.dot)}
                    aria-hidden
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
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
