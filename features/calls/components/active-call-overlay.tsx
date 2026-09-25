"use client";

type ActiveCallOverlayProps = {
  peerName: string;
  taskHint: string;
  statusLabel: string;
  elapsedLabel: string;
  muted: boolean;
  /** Local camera off (video calls only). */
  cameraMuted?: boolean;
  /** Peer muted their mic (LiveKit TrackMuted). */
  peerMicMuted?: boolean;
  /** Peer muted their camera (video calls). */
  peerCameraMuted?: boolean;
  isVideo?: boolean;
  busy: boolean;
  /** Outgoing ring looks different from an in-progress call. */
  mode: "outgoing" | "connecting" | "active" | "ending";
  onToggleMute: () => void;
  onToggleCamera?: () => void;
  onEnd: () => void;
};

export function ActiveCallOverlay({
  peerName,
  taskHint,
  statusLabel,
  elapsedLabel,
  muted,
  cameraMuted = false,
  peerMicMuted = false,
  peerCameraMuted = false,
  isVideo = false,
  busy,
  mode,
  onToggleMute,
  onToggleCamera,
  onEnd,
}: ActiveCallOverlayProps) {
  const isOutboundRing = mode === "outgoing";
  const isConnecting = mode === "connecting";
  const showPeerMedia =
    !isOutboundRing && !isConnecting && mode === "active";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[190] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div
          className={`flex items-center gap-3 border-b border-border px-4 py-3 ${
            isOutboundRing ? "bg-accent-soft/60" : ""
          }`}
        >
          <span
            className={`relative flex size-10 items-center justify-center rounded-full ${
              isOutboundRing || isConnecting
                ? "bg-accent text-accent-foreground"
                : "bg-accent-soft text-accent"
            }`}
          >
            {(isOutboundRing || isConnecting) && (
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/35" />
            )}
            <svg
              viewBox="0 0 24 24"
              className="relative size-5"
              fill="none"
              aria-hidden
            >
              <path
                d="M6.5 4.5h2.2l1.2 3.1-1.4 1.4a12 12 0 0 0 5.5 5.5l1.4-1.4 3.1 1.2v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            {isOutboundRing ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
                  Calling client
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {peerName}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {statusLabel}
                  {taskHint ? ` · ${taskHint}` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-foreground">
                  {peerName}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {statusLabel}
                  {taskHint ? ` · ${taskHint}` : ""}
                </p>
                {showPeerMedia && (peerMicMuted || peerCameraMuted) ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-warning-foreground">
                    {peerMicMuted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5">
                        <MicOffIcon className="size-3" />
                        Mic muted
                      </span>
                    ) : null}
                    {peerCameraMuted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5">
                        <CamOffIcon className="size-3" />
                        Camera off
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {!isOutboundRing && !isConnecting ? (
            <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
              {elapsedLabel}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          {!isOutboundRing && mode === "active" ? (
            <>
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
              {isVideo && onToggleCamera ? (
                <button
                  type="button"
                  onClick={onToggleCamera}
                  disabled={busy}
                  className={`flex h-11 min-w-24 items-center justify-center rounded-full px-4 text-sm font-semibold ${
                    cameraMuted
                      ? "bg-warning-soft text-warning-foreground"
                      : "bg-surface-muted text-foreground"
                  }`}
                >
                  {cameraMuted ? "Cam on" : "Cam off"}
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={onEnd}
            disabled={busy}
            className="flex h-11 min-w-28 items-center justify-center rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isOutboundRing ? "Cancel" : "End call"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.3V12a3 3 0 0 1-.1.8M12 19v2m-4 0h8M5 5l14 14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3a3 3 0 0 1 3 3v2.5M8.5 8.5V12a3.5 3.5 0 0 0 5.6 2.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M19 11a7 7 0 0 1-1.5 4.3M5 11a7 7 0 0 0 10.2 6.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CamOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M3 5l18 14M15 11.5V8a2 2 0 0 0-2-2H6.5M5 8v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1l4 2.5V9.5L16 12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
