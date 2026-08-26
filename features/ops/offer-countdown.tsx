"use client";

import { useEffect, useRef, useState } from "react";
import {
  EARLY_ACCEPT_MS,
  autoAcceptExpiredOffer,
  canAutoAcceptOffer,
  useOfferDecision,
} from "@/features/ops/auto-accept-offer";
import { REJECT_WINDOW_MS } from "@/types/agent";
import { cn } from "@/lib/utils/cn";

type OfferCountdownProps = {
  expiresAt: string;
  taskId?: string;
  autoAccept?: boolean;
  size?: "sm" | "lg";
  onExpire?: () => void;
};

function statusLabel(args: {
  remainingSec: number;
  expired: boolean;
  blocked: boolean;
  flight: string;
  settled: string;
}): string {
  if (args.flight === "reject" || args.settled === "rejected") {
    return "Rejecting offer…";
  }
  if (args.flight === "accept" || args.settled === "accepted") {
    return "Accepting offer…";
  }
  if (args.expired) return "Offer ended";
  if (args.blocked) return "Waiting for your decision";
  return `Accept within ${args.remainingSec}s`;
}

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
  const decision = useOfferDecision(taskId);
  const blocked =
    decision.autoAcceptBlocked ||
    decision.flight !== "none" ||
    decision.settled !== "none";
  const deadline = new Date(expiresAt).getTime();
  const remainingMs = Number.isFinite(deadline)
    ? Math.max(0, deadline - now)
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const expired = remainingMs <= 0;
  const urgent = remainingSec <= 10 && !expired && !blocked;
  const pct = Math.min(100, (remainingMs / REJECT_WINDOW_MS) * 100);

  useEffect(() => {
    fired.current = false;
    seenOpen.current = false;
  }, [taskId]);

  useEffect(() => {
    if (remainingMs > 0) seenOpen.current = true;
  }, [remainingMs]);

  useEffect(() => {
    if (blocked) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [blocked]);

  useEffect(() => {
    if (fired.current) return;
    if (remainingMs > EARLY_ACCEPT_MS) return;
    if (taskId && !canAutoAcceptOffer(taskId)) {
      fired.current = true;
      return;
    }
    fired.current = true;
    void (async () => {
      if (autoAccept && taskId && seenOpen.current) {
        await autoAcceptExpiredOffer(taskId);
      }
      onExpire?.();
    })();
  }, [autoAccept, blocked, onExpire, remainingMs, taskId]);

  const ring = size === "lg" ? 72 : 40;
  const stroke = size === "lg" ? 7 : 4;
  const radius = (ring - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const color = expired || blocked
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
            expired || blocked
              ? "text-muted"
              : urgent
                ? "text-red-600"
                : "text-foreground",
          )}
        >
          {expired ? "0" : remainingSec}
        </span>
      </div>
      {size === "lg" ? (
        <p className={cn("text-sm font-semibold", urgent ? "text-red-600" : "text-foreground")}>
          {statusLabel({
            remainingSec,
            expired,
            blocked,
            flight: decision.flight,
            settled: decision.settled,
          })}
        </p>
      ) : null}
    </div>
  );
}
