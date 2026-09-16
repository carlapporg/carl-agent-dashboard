"use client";

type ActiveCallOverlayProps = {
  peerName: string;
  taskHint: string;
  statusLabel: string;
  elapsedLabel: string;
  muted: boolean;
  busy: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
};

export function ActiveCallOverlay({
  peerName,
  taskHint,
  statusLabel,
  elapsedLabel,
  muted,
  busy,
  onToggleMute,
  onEnd,
}: ActiveCallOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[190] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
              <path
                d="M6.5 4.5h2.2l1.2 3.1-1.4 1.4a12 12 0 0 0 5.5 5.5l1.4-1.4 3.1 1.2v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {peerName}
            </p>
            <p className="truncate text-[11px] text-muted">
              {statusLabel}
              {taskHint ? ` · ${taskHint}` : ""}
            </p>
          </div>
          <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
            {elapsedLabel}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onToggleMute}
            disabled={busy}
            className={`flex h-11 min-w-24 items-center justify-center rounded-full px-4 text-sm font-semibold ${
              muted
                ? "bg-warning-soft text-warning-foreground"
                : "bg-surface-muted text-foreground"
            }`}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={onEnd}
            disabled={busy}
            className="flex h-11 min-w-28 items-center justify-center rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            End call
          </button>
        </div>
      </div>
    </div>
  );
}
