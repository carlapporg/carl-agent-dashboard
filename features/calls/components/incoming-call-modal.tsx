"use client";

import type { CallType } from "@/types/call";

type IncomingCallModalProps = {
  peerName: string;
  taskHint: string;
  callType: CallType;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallModal({
  peerName,
  taskHint,
  callType,
  busy,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="bg-accent-soft px-5 py-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
            Incoming {callType === "VIDEO" ? "video" : "audio"} call
          </p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            {peerName}
          </p>
          <p className="mt-1 text-sm text-muted">{taskHint}</p>
          <div className="mx-auto mt-5 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
              <path
                d="M6.5 4.5h2.2l1.2 3.1-1.4 1.4a12 12 0 0 0 5.5 5.5l1.4-1.4 3.1 1.2v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="flex gap-3 p-4">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-danger-soft text-sm font-semibold text-danger disabled:opacity-60"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-success text-sm font-semibold text-white disabled:opacity-60"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
