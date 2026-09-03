"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { getTasksPerHourAction } from "@/features/dashboard/actions";
import { useOps } from "@/features/ops/ops-provider";
import type { TasksPerHour } from "@/lib/api/dashboard-analytics";
import { themeTokens } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils/cn";

const REFETCH_MS = 5 * 60 * 1000;
const LIVE_REFETCH_DEBOUNCE_MS = 400;
const CHART_POINTS = 12;

type Point = { x: number; y: number };

function normalizeHourPoints(raw: number[]): number[] {
  if (raw.length === 24) return raw;
  if (raw.length > 24) return raw.slice(0, 24);
  return [...raw, ...Array.from({ length: 24 - raw.length }, () => 0)];
}

/** Aggregate 24 hourly buckets into 12 smooth chart points (Figma curve density). */
function downsampleForChart(values: number[]): number[] {
  const buckets: number[] = [];
  for (let i = 0; i < CHART_POINTS; i++) {
    const start = Math.floor((i * values.length) / CHART_POINTS);
    const end = Math.floor(((i + 1) * values.length) / CHART_POINTS);
    const slice = values.slice(start, Math.max(end, start + 1));
    buckets.push(slice.reduce((sum, n) => sum + n, 0) / slice.length);
  }
  return buckets;
}

function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function toSeries(
  values: number[],
  width: number,
  height: number,
  domainMax: number,
  padY = 18,
): Point[] {
  const max = Math.max(domainMax, 1);
  return values.map((value, index) => ({
    x: values.length === 1 ? 0 : (index / (values.length - 1)) * width,
    y: height - padY - (value / max) * (height - padY * 2),
  }));
}

/** Yesterday curve derived from today's API points + deltaPercent. */
function comparisonSeries(
  today: number[],
  deltaPercent: number | null,
): number[] | null {
  if (deltaPercent == null || !Number.isFinite(deltaPercent)) return null;
  const divisor = 1 + deltaPercent / 100;
  if (divisor === 0) return today.map(() => 0);
  return today.map((value) => Math.max(0, value / divisor));
}

type ShiftProgressProps = {
  completed: number;
  inProgress: number;
  total: number;
  waiting?: number;
  progressPercent?: number;
  className?: string;
};

function Donut({
  completed,
  inProgress,
  total,
  progressPercent,
}: {
  completed: number;
  inProgress: number;
  total: number;
  progressPercent?: number;
}) {
  const size = 244;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(total, 1);
  const doneLen = (completed / safe) * circumference;
  const activeLen = (inProgress / safe) * circumference;
  const centerPct =
    progressPercent ?? Math.round(((completed + inProgress) / safe) * 100);

  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={themeTokens.chartQueue}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={themeTokens.chartCompleted}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${doneLen} ${circumference - doneLen}`}
          strokeDashoffset={0}
          className="dash-progress-fill"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={themeTokens.chartProgress}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${activeLen} ${circumference - activeLen}`}
          strokeDashoffset={-doneLen}
          className="dash-progress-fill"
          style={{ animationDelay: "100ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-[2.625rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
          {centerPct}%
        </p>
      </div>
    </div>
  );
}

export function TasksPerHourPanel({ className }: { className?: string }) {
  const ops = useOps();
  const queuePulse = ops?.queuePulse ?? 0;
  const rawId = useId().replace(/:/g, "");
  const gradientId = `tasks-hour-fill-${rawId}`;
  const [hourly, setHourly] = useState<TasksPerHour | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const row = await getTasksPerHourAction();
      setHourly(row);
      setError(null);
    } catch {
      setError("Could not load tasks per hour.");
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      void load();
    }, REFETCH_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [load]);

  /** Refetch when live task queue changes (accept, reject, status updates, socket). */
  useEffect(() => {
    if (queuePulse === 0) return;
    const id = window.setTimeout(() => {
      void load();
    }, LIVE_REFETCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [queuePulse, load]);

  const chart = useMemo(() => {
    if (!hourly) return null;
    const hourly24 = normalizeHourPoints(hourly.points);
    const today = downsampleForChart(hourly24);
    const compare = comparisonSeries(today, hourly.deltaPercent);
    const domainMax = Math.max(...today, ...(compare ?? []), 1);
    const w = 720;
    const h = 176;
    const todayPts = toSeries(today, w, h, domainMax);
    const comparePts = compare ? toSeries(compare, w, h, domainMax) : null;
    const solid = smoothPath(todayPts);
    const dashed = comparePts ? smoothPath(comparePts) : null;
    const area = `${solid} L${w},${h} L0,${h} Z`;
    return { today, compare, w, h, solid, dashed, area };
  }, [hourly]);

  if (error && !hourly) {
    return (
      <div
        className={cn(
          "flex h-[13rem] items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface text-sm text-destructive shadow-[var(--shadow-card)]",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (!hourly || !chart) {
    return (
      <div
        className={cn(
          "flex h-[13rem] items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface text-sm text-muted shadow-[var(--shadow-card)]",
          className,
        )}
      >
        Loading tasks / hour…
      </div>
    );
  }

  const delta = hourly.deltaPercent;
  const deltaLabel =
    delta == null ? null : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
  const trendingUp = delta == null || delta >= 0;
  // Graph draws all 24 hourly buckets for today. The badge must not only show
  // the current hour (often 0) or it looks empty while the curve still peaks.
  const hourIndex = new Date().getUTCHours();
  const thisHourCount = Math.round(hourly.points[hourIndex] ?? 0);
  const todayTotal = Math.round(
    hourly.points.reduce((sum, value) => sum + value, 0),
  );
  const subtitle =
    hourly.label && hourly.label !== "Today"
      ? hourly.label
      : `${thisHourCount} this hour · ${todayTotal} today`;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4 shadow-[var(--shadow-card)] sm:px-5 sm:py-4",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Tasks / Hour
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{subtitle}</p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-accent">
            Keep the streak going
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-bold tabular-nums text-accent"
            title="Total tasks today (all hours on the graph)"
          >
            {todayTotal}
          </span>
          {deltaLabel ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                trendingUp
                  ? "bg-success-soft text-success-foreground"
                  : "bg-destructive/10 text-destructive",
              )}
              title="Change vs previous period"
            >
              {deltaLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-2.5">
        <svg
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          className="h-[6.5rem] w-full overflow-visible sm:h-[7rem]"
          role="img"
          aria-label={`Tasks per hour. ${thisHourCount} this hour, ${todayTotal} today.`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeTokens.accent} stopOpacity="0.32" />
              <stop offset="45%" stopColor={themeTokens.accent} stopOpacity="0.14" />
              <stop offset="100%" stopColor={themeTokens.accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              y1={chart.h * ratio}
              x2={chart.w}
              y2={chart.h * ratio}
              stroke={themeTokens.border}
              strokeOpacity={0.35}
              strokeWidth="1"
            />
          ))}

          <path d={chart.area} fill={`url(#${gradientId})`} />
          {chart.dashed ? (
            <path
              d={chart.dashed}
              fill="none"
              stroke={themeTokens.accentMuted}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 8"
              opacity={0.95}
            />
          ) : null}
          <path
            d={chart.solid}
            fill="none"
            stroke={themeTokens.chartLine}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function ShiftProgress({
  completed,
  inProgress,
  total,
  waiting,
  progressPercent,
  className,
}: ShiftProgressProps) {
  const remaining = waiting ?? Math.max(total - completed - inProgress, 0);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-[var(--radius-card)] bg-accent-soft p-5 shadow-[var(--shadow-card)] md:p-6 md:py-8",
        className,
      )}
    >
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        Shift progress
      </p>
      <p className="mt-1.5 shrink-0 text-xs font-medium leading-snug text-accent">
        {completed} done • {inProgress} in motion • {remaining} waiting
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center py-5 md:py-6">
        <Donut
          completed={completed}
          inProgress={inProgress}
          total={total}
          progressPercent={progressPercent}
        />
      </div>

      <div className="mt-auto shrink-0 pt-1">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-foreground md:justify-start">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: themeTokens.chartCompleted }}
            />
            Completed
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: themeTokens.chartProgress }}
            />
            In progress
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: themeTokens.chartQueue }}
            />
            Still in queue
          </span>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted md:text-left">
          Updates automatically as tasks move through the queue.
        </p>
      </div>
    </div>
  );
}
