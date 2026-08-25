"use client";

import { useEffect, useRef, useState } from "react";
import { autoAcceptExpiredOffer } from "@/features/ops/auto-accept-offer";
import { REJECT_WINDOW_MS } from "@/types/agent";
import { cn } from "@/lib/utils/cn";

/** Accept a bit before Nest's miss timer so the request is not too late. */
const EARLY_ACCEPT_MS = 2_500;

type OfferCountdownProps = {
  expiresAt: string;
  taskId?: string;
  autoAccept?: boolean;
  size?: "sm" | "lg";
  onExpire?: () => void;
};

export function OfferCountdown({
  expiresAt,
  taskId,
  autoAccept = false,
  size = "sm",
  onExpire,
}: OfferCountdownProps) {
  const fired = useRef(false);
  const seenOpen = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const deadline = new Date(expiresAt).getTime();
  const remainingMs = Number.isFinite(deadline)
    ? Math.max(0, deadline - now)
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const expired = remainingMs <= 0;
  const urgent = remainingSec <= 10 && !expired;
  const pct = Math.min(100, (remainingMs / REJECT_WINDOW_MS) * 100);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    fired.current = false;
    seenOpen.current = false;
  }, [taskId]);

  useEffect(() => {
    if (remainingMs > 0) seenOpen.current = true;
  }, [remainingMs]);

  useEffect(() => {
    if (fired.current) return;
    if (remainingMs > EARLY_ACCEPT_MS) return;
    fired.current = true;
    void (async () => {
      if (autoAccept && taskId && seenOpen.current) {
        await autoAcceptExpiredOffer(taskId);
      }
      onExpire?.();
    })();
  }, [autoAccept, onExpire, remainingMs, taskId]);

  const ring = size === "lg" ? 72 : 40;
  const stroke = size === "lg" ? 7 : 4;
  const radius = (ring - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const color = expired
    ? "#9ca3af"
    : urgent
      ? "#dc2626"
      : remainingSec <= 20
        ? "#d97706"
        : "#4f7cff";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        urgent && "ops-timer-pulse",
      )}
    >
      <div className="relative shrink-0" style={{ width: ring, height: ring }}>
        <svg width={ring} height={ring} className="-rotate-90" aria-hidden>
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={stroke}
          />
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold tabular-nums",
            size === "lg" ? "text-lg" : "text-xs",
            expired ? "text-muted" : urgent ? "text-red-600" : "text-foreground",
          )}
        >
          {expired ? "0" : remainingSec}
        </span>
      </div>
      {size === "lg" ? (
        <p className={cn("text-sm font-semibold", urgent ? "text-red-600" : "text-foreground")}>
          {expired
            ? autoAccept && seenOpen.current
              ? "Accepting offer…"
              : "Offer ended"
            : `Accept within ${remainingSec}s`}
        </p>
      ) : null}
    </div>
  );
}
