"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { useEffect, useState, type CSSProperties } from "react";

type MetricStatCardProps = {
  label: string;
  value: number;
  ringValue?: number;
  hint: string;
  color: string;
  className?: string;
  style?: CSSProperties;
};

export function MetricStatCard({
  label,
  value,
  ringValue = 0,
  hint,
  color,
  className,
  style,
}: MetricStatCardProps) {
  const size = 64;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = useState(value);
  useEffect(() => {
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

  const maxForRing = Math.max(value, ringValue, 1);
  const pct =
    value === 0
      ? 0
      : Math.min(100, Math.max(12, (ringValue / maxForRing) * 100));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Card className={cn("p-5", className)} style={style}>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width={size} height={size} className="-rotate-90" aria-hidden>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#eef2f7"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={value === 0 ? circumference : offset}
              className="dash-progress-fill"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-foreground">
            {shown}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {shown}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {label}
          </p>
          <p className="mt-1 text-sm leading-snug text-muted-dim">{hint}</p>
        </div>
      </div>
    </Card>
  );
}
