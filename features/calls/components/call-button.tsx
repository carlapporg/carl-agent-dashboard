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
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
        "bg-accent text-accent-foreground shadow-sm shadow-accent/30",
        "transition-[background-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "hover:bg-accent-hover hover:shadow-md hover:shadow-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:bg-accent/40 disabled:opacity-60 disabled:shadow-none",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
        <path
          d="M6.5 4.5h2.2l1.2 3.1-1.4 1.4a12 12 0 0 0 5.5 5.5l1.4-1.4 3.1 1.2v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
