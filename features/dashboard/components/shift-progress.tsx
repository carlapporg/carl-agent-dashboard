"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTasksPerDaySplitAction,
  getTasksPerHourAction,
} from "@/features/dashboard/actions";
import {
  MonthFilterPill,
  type MonthFilterValue,
} from "@/features/dashboard/components/month-filter-pill";
import { useOps } from "@/features/ops/ops-provider";
import type { TasksPerHour } from "@/lib/api/dashboard-analytics";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

const REFETCH_MS = 5 * 60 * 1000;
const LIVE_REFETCH_DEBOUNCE_MS = 400;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Tasks-per-day bars (week view)
 * -----------------------------
 * Track: `#f6f6f6` · Fill idle `#d9d9d9` · Hover blue→white `#377DFF → #fff`
 * Height = (completed + inProgress) / axisMax
 */
const BAR_TRACK_MAX_PX = 57;
const BAR_FILL_MAX_PX = 53;

function normalizeHourPoints(raw: number[]): number[] {
  if (raw.length === 24) return raw;
  if (raw.length > 24) return raw.slice(0, 24);
  return [...raw, ...Array.from({ length: 24 - raw.length }, () => 0)];
}

/** Collapse 24 hours into 8 day-style buckets for legacy today responses. */
function toDayBuckets(values: number[]): number[] {
  const buckets: number[] = [];
  for (let i = 0; i < 8; i++) {
    const start = Math.floor((i * values.length) / 8);
    const end = Math.floor(((i + 1) * values.length) / 8);
    const slice = values.slice(start, Math.max(end, start + 1));
    buckets.push(slice.reduce((sum, n) => sum + n, 0));
  }
  return buckets;
}

type ChartColumn = {
  label: string;
  completed: number;
  inProgress: number;
  taskCount: number;
};

function dateKeyInZone(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function weekdayKeyInZone(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(date);
    return short.slice(0, 3).toLowerCase();
  } catch {
    return WEEKDAY_KEYS[date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1] ?? null;
  }
}

function isCompletedTask(task: Task): boolean {
  return (
    task.backendStatus === "COMPLETED" || task.status === "completed"
  );
}

function isInProgressTask(task: Task): boolean {
  return (
    task.backendStatus === "IN_PROGRESS" ||
    task.backendStatus === "ASSIGNED" ||
    task.status === "in_progress" ||
    task.status === "assigned"
  );
}

function bump(map: Map<string, number>, key: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function thisWeekDateKeys(timeZone: string, now = new Date()): string[] {
  const todayKey =
    dateKeyInZone(now.toISOString(), timeZone) ??
    now.toISOString().slice(0, 10);
  // Build noon UTC anchors for today±8 days, then pick Mon→Sun in zone.
  const probe = new Date(`${todayKey}T12:00:00.000Z`);
  const keys: { key: string; weekday: string }[] = [];
  for (let delta = -8; delta <= 8; delta++) {
    const d = new Date(probe.getTime() + delta * 86400000);
    const key = dateKeyInZone(d.toISOString(), timeZone);
    const weekday = weekdayKeyInZone(d.toISOString(), timeZone);
    if (key && weekday) keys.push({ key, weekday });
  }
  const monIndex = keys.findIndex((row) => row.key === todayKey);
  const todayWeekday = keys[monIndex]?.weekday ?? "mon";
  const todayOffset = WEEKDAY_KEYS.indexOf(
    todayWeekday as (typeof WEEKDAY_KEYS)[number],
  );
  const start = monIndex - (todayOffset >= 0 ? todayOffset : 0);
  return WEEKDAY_KEYS.map((_, i) => keys[start + i]?.key).filter(
    (k): k is string => Boolean(k),
  );
}

function lookupCount(
  map: Map<string, number>,
  bucketKey: string,
  label: string,
  index: number,
  weekDates: string[],
): number {
  const raw = bucketKey.trim();
  const key = raw.toLowerCase();
  if (map.has(raw)) return map.get(raw) ?? 0;
  if (map.has(key)) return map.get(key) ?? 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return map.get(raw) ?? 0;

  const weekday = key.slice(0, 3);
  const weekdayIndex = WEEKDAY_KEYS.indexOf(
    weekday as (typeof WEEKDAY_KEYS)[number],
  );
  if (weekdayIndex >= 0 && weekDates[weekdayIndex]) {
    return map.get(weekDates[weekdayIndex]!) ?? map.get(weekday) ?? 0;
  }

  const fromLabel = label.trim().slice(0, 3).toLowerCase();
  const labelIndex = WEEKDAY_KEYS.indexOf(
    fromLabel as (typeof WEEKDAY_KEYS)[number],
  );
  if (labelIndex >= 0 && weekDates[labelIndex]) {
    return map.get(weekDates[labelIndex]!) ?? map.get(fromLabel) ?? 0;
  }

  if (weekDates[index]) return map.get(weekDates[index]!) ?? 0;
  return 0;
}

function buildSplitMaps(
  history: Task[],
  active: Task[],
  timeZone: string,
  weekDates: string[],
): { completed: Map<string, number>; inProgress: Map<string, number> } {
  const allowed = new Set(weekDates);
  const completed = new Map<string, number>();
  const inProgress = new Map<string, number>();

  for (const task of history) {
    if (!isCompletedTask(task)) continue;
    const at = task.completedAt ?? task.updatedAt;
    const day = dateKeyInZone(at, timeZone);
    if (!day || !allowed.has(day)) continue;
    bump(completed, day);
  }

  for (const task of active) {
    if (!isInProgressTask(task)) continue;
    const at = task.updatedAt || task.createdAt;
    const day = dateKeyInZone(at, timeZone);
    if (!day || !allowed.has(day)) continue;
    bump(inProgress, day);
  }

  return { completed, inProgress };
}

function buildChartColumns(
  hourly: TasksPerHour,
  split: { history: Task[]; active: Task[] } | null,
): ChartColumn[] {
  const timeZone = hourly.timeZone ?? "UTC";
  const bucketDates = hourly.buckets
    .map((b) => b.key.trim())
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
  const weekDates =
    bucketDates.length > 0 ? bucketDates : thisWeekDateKeys(timeZone);
  const maps = split
    ? buildSplitMaps(split.history, split.active, timeZone, weekDates)
    : null;
  const apiHasSplit = hourly.buckets.some((b) => b.hasStatusSplit);

  if (hourly.buckets.length > 0) {
    return hourly.buckets.map((b, index) => {
      let completed = 0;
      let inProgress = 0;

      if (apiHasSplit && b.hasStatusSplit) {
        completed = b.completed;
        inProgress = b.inProgress;
      } else if (maps) {
        completed = lookupCount(
          maps.completed,
          b.key,
          b.label,
          index,
          weekDates,
        );
        inProgress = lookupCount(
          maps.inProgress,
          b.key,
          b.label,
          index,
          weekDates,
        );
        if (completed === 0 && inProgress === 0 && b.taskCount > 0) {
          completed = b.taskCount;
        }
      } else {
        completed = b.taskCount;
      }

      return {
        label: b.label,
        completed,
        inProgress,
        taskCount: completed + inProgress,
      };
    });
  }

  const points = hourly.points;
  if (points.length === 24) {
    return toDayBuckets(normalizeHourPoints(points)).map((count, index) => ({
      label: DAY_LABELS[index] ?? `D${index + 1}`,
      completed: count,
      inProgress: 0,
      taskCount: count,
    }));
  }

  return points.map((count, index) => ({
    label: `${index + 1}`,
    completed: count,
    inProgress: 0,
    taskCount: count,
  }));
}

/** Build 6 descending Y ticks for task counts (top → bottom). */
function taskAxisTicks(maxTasks: number): number[] {
  const peak = Math.max(1, Math.ceil(maxTasks));
  const nicePeaks = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
  const top = nicePeaks.find((n) => n >= peak) ?? Math.ceil(peak / 10) * 10;
  const step = top / 5;
  return [top, top - step, top - 2 * step, top - 3 * step, top - 4 * step, 0].map(
    (n) => Math.round(n),
  );
}

function tasksToHeightPct(taskCount: number, axisMax: number): number {
  if (taskCount <= 0 || axisMax <= 0) return 0;
  return Math.min(100, (taskCount / axisMax) * 100);
}

type ShiftProgressProps = {
  completed: number;
  inProgress: number;
  total: number;
  waiting?: number;
  progressPercent?: number;
  className?: string;
  rangeLabel?: MonthFilterValue;
  onRangeChange?: (value: MonthFilterValue) => void;
};

function ConcentricRings({
  completed,
  inProgress,
  waiting,
  progressPercent,
}: {
  completed: number;
  inProgress: number;
  waiting: number;
  progressPercent: number;
}) {
  // Live stats drive arc length — not hardcoded.
  const safe = Math.max(completed + inProgress + waiting, 1);
  const donePct = completed / safe;
  const activePct = inProgress / safe;
  const waitPct = waiting / safe;

  /**
   * Exact Figma Progress (200:24962) sizes:
   * fills 213 / 171 / 128, tracks 205 / 163 / 123, thickness from innerRadius
   */
  const rings = [
    {
      size: 213,
      trackSize: 205,
      stroke: 8.54,
      pct: donePct,
      color: "#c7ffc7",
      opacity: 1,
    },
    {
      size: 171,
      trackSize: 163,
      stroke: 8.15,
      pct: activePct,
      color: "#c9f1ff",
      opacity: 0.8,
    },
    {
      size: 128,
      trackSize: 123,
      stroke: 8.13,
      pct: waitPct,
      color: "#c3d8ff",
      opacity: 1,
    },
  ] as const;

  const CHART = 213;

  return (
    <div className="relative h-[213px] w-[213px] shrink-0 grow-0">
      {rings.map((ring) => {
        const fillR = (ring.size - ring.stroke) / 2;
        const trackR = ring.trackSize / 2;
        const c = 2 * Math.PI * fillR;
        const fillOffset = (ring.size - CHART) / -2;
        const trackOffset = (ring.trackSize - CHART) / -2;
        const pct = Math.max(0, Math.min(1, ring.pct));
        const filled = pct * c;
        // Round caps draw a dot even at 0% — skip empty arcs.
        const showArc = filled > 1;

        return (
          <div key={ring.size} className="pointer-events-none absolute inset-0">
            {/* Dashed track — Figma 205 / 163 / 123 */}
            <svg
              width={ring.trackSize}
              height={ring.trackSize}
              className="absolute"
              style={{ left: trackOffset, top: trackOffset }}
              aria-hidden
            >
              <circle
                cx={ring.trackSize / 2}
                cy={ring.trackSize / 2}
                r={trackR - 0.25}
                fill="none"
                stroke="#d9d9d9"
                strokeOpacity={0.5}
                strokeWidth={0.5}
                strokeDasharray="5 5"
              />
            </svg>

            {/* Progress arc — length = this stat / (done+inProgress+waiting) */}
            {showArc ? (
              <svg
                width={ring.size}
                height={ring.size}
                className="absolute -rotate-90"
                style={{ left: fillOffset, top: fillOffset }}
                aria-hidden
              >
                <circle
                  cx={ring.size / 2}
                  cy={ring.size / 2}
                  r={fillR}
                  fill="none"
                  stroke={ring.color}
                  strokeOpacity={ring.opacity}
                  strokeWidth={ring.stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${c}`}
                  className="dash-progress-fill"
                />
              </svg>
            ) : null}
          </div>
        );
      })}
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <p className="text-[22px] font-semibold tracking-[-0.05em] text-foreground">
          {progressPercent}%
        </p>
        <p className="mt-[2px] text-[12px] font-normal tracking-[-0.05em] text-foreground">
          Progress
        </p>
      </div>
    </div>
  );
}

/** Idle = gray + gray glow. Hover = blue→white + blue glow. Shadow always on. */
function BarFill({
  heightPct,
  hovered,
  gradientId,
}: {
  heightPct: number;
  hovered: boolean;
  gradientId: string;
}) {
  if (heightPct <= 0) return null;

  const shadow = hovered
    ? "drop-shadow(0 12px 18px rgba(55, 125, 255, 0.45))"
    : "drop-shadow(0 10px 16px rgba(16, 24, 40, 0.22))";

  if (!hovered) {
    return (
      <span
        className="absolute bottom-0 left-1/2 w-full -translate-x-1/2 rounded-[10px] bg-[#d9d9d9]"
        style={{
          height: `${heightPct}%`,
          maxWidth: BAR_FILL_MAX_PX,
          filter: shadow,
        }}
        aria-hidden
      />
    );
  }

  return (
    <span
      className="absolute bottom-0 left-1/2 w-full max-w-[53px] -translate-x-1/2"
      style={{ height: `${heightPct}%`, filter: shadow }}
      aria-hidden
    >
      <svg
        viewBox="0 0 53 129"
        preserveAspectRatio="none"
        overflow="visible"
        className="size-full"
      >
        <path
          d="M43 0C48.5228 0 53 4.47715 53 10V119C53 124.523 48.5228 129 43 129H10C4.47715 129 0 124.523 0 119V10C0 4.47715 4.47715 0 10 0H20C20 3.31371 22.6863 6 26 6C29.3137 6 32 3.31371 32 0H43Z"
          fill={`url(#${gradientId})`}
        />
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="53"
            y2="129"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#377DFF" />
            <stop offset="1" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function TasksPerHourPanel({ className }: { className?: string }) {
  const ops = useOps();
  const queuePulse = ops?.queuePulse ?? 0;
  const [hourly, setHourly] = useState<TasksPerHour | null>(null);
  const [split, setSplit] = useState<{
    history: Task[];
    active: Task[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [row, splitRow] = await Promise.all([
        getTasksPerHourAction("this_week"),
        getTasksPerDaySplitAction().catch(() => null),
      ]);
      setHourly(row);
      setSplit(splitRow);
      setError(null);
    } catch {
      setError("Could not load tasks per day.");
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

  useEffect(() => {
    if (queuePulse === 0) return;
    const id = window.setTimeout(() => {
      void load();
    }, LIVE_REFETCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [queuePulse, load]);

  const chart = useMemo(() => {
    if (!hourly) return null;
    const columns = buildChartColumns(hourly, split);
    const max = Math.max(...columns.map((c) => c.taskCount), 1);
    const ticks = taskAxisTicks(max);
    const axisMax = ticks[0] ?? max;
    return { columns, max, ticks, axisMax };
  }, [hourly, split]);

  if (error && !hourly) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px] border border-border bg-surface text-sm text-destructive",
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
          "flex items-center justify-center rounded-[10px] border border-border bg-surface text-sm text-muted",
          className,
        )}
      >
        Loading tasks / day…
      </div>
    );
  }

  const weekCompleted = chart.columns.reduce((sum, c) => sum + c.completed, 0);
  const weekInProgress = chart.columns.reduce(
    (sum, c) => sum + c.inProgress,
    0,
  );
  const subtitle = `${weekCompleted} Completed · ${weekInProgress} In Progress`;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-semibold tracking-[-0.05em] text-foreground">
            Tasks Per Day
          </h3>
          <p className="mt-2 text-[12px] tracking-[-0.02em] text-muted">
            <span className="font-medium text-foreground">{subtitle}</span>{" "}
            <span className="text-accent">Keep the streak going</span>
          </p>
        </div>
        <span className="inline-flex h-[35px] items-center rounded-[40px] bg-surface-muted px-4 text-[12px] font-medium tracking-[-0.05em] text-foreground">
          This week
        </span>
      </div>

      {/* Extra top room so hover tooltip stays inside the card */}
      <div className="relative mt-6 flex min-h-0 flex-1 gap-3 pt-14">
        <div className="flex w-8 flex-col justify-between pb-6 pt-1 text-right text-[12px] tracking-[-0.02em] text-muted-dim">
          {chart.ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between">
            {chart.ticks.map((tick) => (
              <div key={`grid-${tick}`} className="border-t border-border" />
            ))}
          </div>

          <div
            className="absolute inset-x-0 bottom-6 top-2 flex items-end justify-between gap-4 overflow-visible px-1"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {chart.columns.map((column, index) => {
              const fillPct = tasksToHeightPct(
                column.taskCount,
                chart.axisMax,
              );
              const isHovered = hoverIndex === index;

              return (
                <button
                  key={`${column.label}-${index}`}
                  type="button"
                  className={cn(
                    "relative flex h-full flex-1 items-end justify-center overflow-visible rounded-[10px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#377dff]",
                  )}
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  onBlur={() =>
                    setHoverIndex((current) =>
                      current === index ? null : current,
                    )
                  }
                  aria-label={`${column.label}: ${column.completed} completed, ${column.inProgress} in progress`}
                >
                  <span
                    className="relative h-full w-full overflow-visible rounded-[10px] bg-[#f6f6f6]"
                    style={{ maxWidth: BAR_TRACK_MAX_PX }}
                  >
                    <BarFill
                      heightPct={fillPct}
                      hovered={isHovered}
                      gradientId={`taskDayFill-${index}`}
                    />
                    {isHovered && fillPct > 0 ? (
                      <span
                        className="absolute left-1/2 z-[1] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface shadow-[0_0_0_2px_rgba(55,125,255,0.35)]"
                        style={{ top: `${100 - fillPct}%` }}
                        aria-hidden
                      />
                    ) : null}
                  </span>

                  {isHovered ? (
                    <span
                      className="pointer-events-none absolute left-1/2 z-10 w-[124px] -translate-x-1/2 rounded-[8px] border border-accent/30 bg-surface px-2 py-1.5 text-left shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
                      style={{
                        top: `${100 - fillPct}%`,
                        transform: "translate(-50%, calc(-100% - 10px))",
                      }}
                    >
                      <span className="block text-[10px] font-medium text-foreground">
                        {column.label}
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-foreground">
                        <span className="size-1.5 rounded-full bg-[#d9d9d9]" />
                        {column.completed} Completed
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-foreground">
                        <span className="size-1.5 rounded-full bg-[#377dff]" />
                        {column.inProgress} In Progress
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 text-center text-[12px] tracking-[-0.02em] text-muted-dim">
            {chart.columns.map((column, index) => (
              <span key={`${column.label}-axis-${index}`} className="flex-1">
                {column.label}
              </span>
            ))}
          </div>
        </div>
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
  rangeLabel = "Today",
  onRangeChange,
}: ShiftProgressProps) {
  const remaining = waiting ?? Math.max(total - completed - inProgress, 0);
  const centerPct =
    progressPercent ??
    Math.round(((completed + inProgress) / Math.max(total, 1)) * 100);

  return (
    <div
      className={cn(
        /* Figma Progress 200:24962 — 425×424 composition */
        "relative h-[424px] w-full overflow-hidden rounded-[10px] border border-border bg-surface",
        className,
      )}
    >
      <h3 className="absolute left-[15px] top-[29px] text-[22px] font-semibold leading-[27px] tracking-[-0.05em] text-foreground">
        Task Progress
      </h3>

      <div className="absolute top-[25px] right-[15px]">
        <MonthFilterPill value={rangeLabel} onChange={onRangeChange} />
      </div>

      <p className="absolute left-[15px] top-[93px] z-[1] text-[18px] font-semibold leading-[22px] tracking-[-0.05em] text-foreground">
        Total Task
        <br />
        {total}
      </p>

      <div
        className="absolute top-[136px]"
        style={{ left: "min(197px, 46.35%)" }}
      >
        <ConcentricRings
          completed={completed}
          inProgress={inProgress}
          waiting={remaining}
          progressPercent={centerPct}
        />
      </div>

      <div className="absolute inset-x-[15px] top-[385px] flex items-center justify-between text-[12px] font-normal leading-[15px] tracking-[-0.05em] text-foreground">
        <span className="inline-flex items-center gap-[10px]">
          <span className="size-2 shrink-0 rounded-full bg-[#c7ffc7]" />
          {completed} Task Done
        </span>
        <span className="inline-flex items-center gap-[10px]">
          <span className="size-2 shrink-0 rounded-full bg-[#d4f4ff]" />
          {inProgress} Task in Progress
        </span>
        <span className="inline-flex items-center gap-[10px]">
          <span className="size-2 shrink-0 rounded-full bg-[#c3d8ff]" />
          {remaining} Task in Waiting
        </span>
      </div>
    </div>
  );
}
