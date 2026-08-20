"use client";

import { useEffect, useState } from "react";

type SlaCountdownProps = {
  expiresAt: string;
  className?: string;
};

function remainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function urgency(ms: number): "ok" | "warn" | "critical" | "expired" {
  if (ms <= 0) return "expired";
  if (ms <= 2 * 60_000) return "critical";
  if (ms <= 5 * 60_000) return "warn";
  return "ok";
}

/** Renders countdown from server-authoritative expiresAt (no local SLA clock). */
export function SlaCountdown({ expiresAt, className }: SlaCountdownProps) {
  const [ms, setMs] = useState(() => remainingMs(expiresAt));

  useEffect(() => {
    setMs(remainingMs(expiresAt));
    const id = window.setInterval(() => {
      setMs(remainingMs(expiresAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const level = urgency(ms);
  const color =
    level === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : level === "warn"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : level === "critical"
          ? "text-red-700 bg-red-50 border-red-200"
          : "text-muted bg-surface-hover border-border";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${color} ${className ?? ""}`}
    >
      {level === "expired" ? "Expired" : formatRemaining(ms)}
    </span>
  );
}
