"use client";

import { useCall } from "@/features/calls/call-provider";
import { cn } from "@/lib/utils/cn";
import type { CallType } from "@/types/call";

type CallButtonProps = {
  taskId: string;
  customerName?: string | null;
  taskTitle?: string | null;
  taskNumber?: string | number | null;
  disabled?: boolean;
  className?: string;
  callType?: CallType;
};

export function CallButton({
  taskId,
  customerName,
  taskTitle,
  taskNumber,
  disabled,
  className,
  callType = "AUDIO",
}: CallButtonProps) {
  const call = useCall();
  const busy = Boolean(call && call.phase !== "idle") || Boolean(call?.busy);

  return (
    <button
      type="button"
      disabled={disabled || !call || busy}
      title={
        customerName?.trim()
          ? `Call ${customerName.trim()}`
          : "Start audio call"
      }
      aria-label={
        customerName?.trim()
          ? `Call ${customerName.trim()}`
          : "Start audio call"
      }
      onClick={() => {
        void call?.startCall(taskId, callType, {
          customerName,
          taskTitle,
          taskNumber,
        });
      }}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors",
        "hover:border-accent hover:bg-accent-soft hover:text-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
        <path
          d="M6.5 4.5h2.2l1.2 3.1-1.4 1.4a12 12 0 0 0 5.5 5.5l1.4-1.4 3.1 1.2v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
