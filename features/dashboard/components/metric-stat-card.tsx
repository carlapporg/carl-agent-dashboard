"use client";

import { cn } from "@/lib/utils/cn";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type MetricStatCardProps = {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function MetricStatCard({
  label,
  value,
  hint,
  icon,
  className,
  style,
}: MetricStatCardProps) {
  const numeric = typeof value === "number";
  const [shown, setShown] = useState(numeric ? value : 0);

  useEffect(() => {
    if (!numeric) return;
    const from = shown;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 420;
    let frame = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / dur);
      setShown(Math.round(from + (to - from) * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from previous shown
  }, [value]);

  const display = numeric ? String(shown).padStart(2, "0") : value;

  return (
    <div
      className={cn(
        "flex h-full min-h-[7.75rem] flex-col rounded-[var(--radius-card)] bg-accent-soft p-3.5 shadow-[var(--shadow-card)] sm:p-4",
        className,
      )}
      style={style}
    >
      <div className="flex flex-1 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-xs font-semibold leading-tight text-muted">
            {label}
          </p>
          <p className="mt-1 text-[1.5rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
            {display}
          </p>
          <p className="mt-auto pt-1.5 line-clamp-2 text-[10px] leading-snug text-muted">
            {hint}
          </p>
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-[0_1px_6px_rgba(56,114,232,0.16)] [&_svg]:size-3.5"
          aria-hidden
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
