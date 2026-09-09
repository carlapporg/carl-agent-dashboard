"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTasksPerHourAction } from "@/features/dashboard/actions";
import { MonthFilterPill } from "@/features/dashboard/components/month-filter-pill";
import { useOps } from "@/features/ops/ops-provider";
import type { TasksPerHour } from "@/lib/api/dashboard-analytics";
import { cn } from "@/lib/utils/cn";

const REFETCH_MS = 5 * 60 * 1000;
const LIVE_REFETCH_DEBOUNCE_MS = 400;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

/**
 * Figma Task Hour bars (Dashboard Home / Task Hour panel)
 * -------------------------------------------------------
 * Track: full-height lane `#f6f6f6` (always)
 * Fill:  solid `#d9d9d9` by default, blue→white ONLY while hovered
 * Shadow: soft drop-shadow on EVERY fill (gray idle / blue glow hover)
 *
 * Y-axis ticks are NON-LINEAR but equally spaced visually:
 *   4h, 6h, 8h, 12h, 16h, 24h  (bottom → top)
 * Bar height must use hoursToHeightPct(), not linear %.
 *
 * Figma fill heights land ~6.8h–11.2h (tallest near the 12h line — NOT 24h).
 * Agent data: API = 24 UTC hourly task counts for today, folded into 8 columns.
 * Map: hoursEquivalent = (bucket / maxBucket) * AXIS_PEAK_HOURS (12).
 */
const BAR_TRACK_MAX_PX = 57;
const BAR_FILL_MAX_PX = 53;
/** Tallest bar sits on the 12h tick — matches Figma, not the 24h ceiling. */
const AXIS_PEAK_HOURS = 12;
/** Bottom → top hour labels (equal visual gaps, unequal hour gaps). */
const HOUR_TICKS = [4, 6, 8, 12, 16, 24] as const;
const Y_AXIS_LABELS = ["24h", "16h", "12h", "8h", "6h", "4h"] as const;

function normalizeHourPoints(raw: number[]): number[] {
  if (raw.length === 24) return raw;
  if (raw.length > 24) return raw.slice(0, 24);
  return [...raw, ...Array.from({ length: 24 - raw.length }, () => 0)];
}

/** Collapse 24 hours into 8 day-style buckets for the Figma bar chart. */
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

/**
 * Map a hour value onto chart height % using Figma’s equal-spaced ticks.
 * Bottom grid = 4h (0%), then 6h→20%, 8h→40%, 12h→60%, 16h→80%, 24h→100%.
 */
function hoursToHeightPct(hours: number): number {
  const ticks = HOUR_TICKS;
  if (hours <= 0) return 0;
  if (hours <= ticks[0]!) {
    // At or below the bottom tick (4h): sit on the baseline.
    return 0;
  }
  if (hours >= ticks[ticks.length - 1]!) return 100;
  for (let i = 0; i < ticks.length - 1; i++) {
    const lo = ticks[i]!;
    const hi = ticks[i + 1]!;
    if (hours <= hi) {
      const t = (hours - lo) / (hi - lo);
      return ((i + t) / (ticks.length - 1)) * 100;
    }
  }
  return 100;
}

/** Format axis hours as HH:MM:SS for the hover tooltip. */
function formatDurationLabel(hours: number): string {
  const totalSec = Math.max(0, Math.round(hours * 3600));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s} Hours`;
}

type ShiftProgressProps = {
  completed: number;
  inProgress: number;
  total: number;
  waiting?: number;
  progressPercent?: number;
  className?: string;
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
        <p className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
          {progressPercent}%
        </p>
        <p className="mt-[2px] text-[12px] font-normal tracking-[-0.05em] text-[#1f1f21]">
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
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (queuePulse === 0) return;
    const id = window.setTimeout(() => {
      void load();
    }, LIVE_REFETCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [queuePulse, load]);

  const chart = useMemo(() => {
    if (!hourly) return null;
    const buckets = toDayBuckets(normalizeHourPoints(hourly.points));
    const max = Math.max(...buckets, 1);
    return { buckets, max };
  }, [hourly]);

  if (error && !hourly) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px] border border-[#e7e7e7] bg-white text-sm text-destructive",
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
          "flex items-center justify-center rounded-[10px] border border-[#e7e7e7] bg-white text-sm text-muted",
          className,
        )}
      >
        Loading tasks / hour…
      </div>
    );
  }

  const hoursToday = hourly.points.filter((n) => n > 0).length;
  const hoveredValue =
    hoverIndex === null ? 0 : (chart.buckets[hoverIndex] ?? 0);
  const hoveredHours =
    hoveredValue <= 0 ? 0 : (hoveredValue / chart.max) * AXIS_PEAK_HOURS;
  const hoveredCount = Math.round(hoveredValue);

  return (
    <div
      className={cn(
        "flex flex-col overflow-visible rounded-[10px] border border-[#e7e7e7] bg-white p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-semibold tracking-[-0.05em] text-[#1f1f21]">
            Task Hour
          </h3>
          <p className="mt-2 text-[12px] tracking-[-0.02em] text-[rgba(0,0,0,0.5)]">
            <span className="font-medium text-[#1f1f21]">
              {hoursToday} Hours Today
            </span>{" "}
            <span className="text-[#377dff]">Keep the streak going</span>
          </p>
        </div>
        <MonthFilterPill />
      </div>

      <div className="relative mt-6 flex min-h-0 flex-1 gap-3 overflow-visible">
        <div className="flex w-8 flex-col justify-between pb-6 pt-1 text-right text-[12px] tracking-[-0.02em] text-[#98a2b3]">
          {Y_AXIS_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1 overflow-visible">
          <div className="absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-t border-[#e7e7e7]" />
            ))}
          </div>

          <div
            className="absolute inset-x-0 bottom-6 top-2 flex items-end justify-between gap-4 overflow-visible px-1"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {chart.buckets.map((value, index) => {
              // Tallest day → 12h tick (Figma). Then non-linear Y mapping.
              const hoursEquivalent =
                value <= 0 ? 0 : (value / chart.max) * AXIS_PEAK_HOURS;
              const fillPct = hoursToHeightPct(hoursEquivalent);
              const hovered = hoverIndex === index;

              return (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "relative flex h-full flex-1 items-end justify-center overflow-visible rounded-[10px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#377dff]",
                  )}
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  onBlur={() =>
                    setHoverIndex((current) =>
                      current === index ? null : current,
                    )
                  }
                  aria-label={`${DAY_LABELS[index]}: ${Math.round(value)} tasks (~${hoursEquivalent.toFixed(1)}h on axis)`}
                >
                  {/* TRACK — full-height light gray lane */}
                  <span
                    className="relative h-full w-full overflow-visible rounded-[10px] bg-[#f6f6f6]"
                    style={{ maxWidth: BAR_TRACK_MAX_PX }}
                  >
                    <BarFill
                      heightPct={fillPct}
                      hovered={hovered}
                      gradientId={`taskHourFill-${index}`}
                    />
                    {hovered && fillPct > 0 ? (
                      <span
                        className="absolute left-1/2 z-[1] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(55,125,255,0.35)]"
                        style={{ top: `${100 - fillPct}%` }}
                        aria-hidden
                      />
                    ) : null}
                  </span>

                  {hovered ? (
                    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 w-[112px] -translate-x-1/2 -translate-y-full rounded-[8px] border border-[#e8f0ff] bg-white px-2 py-1.5 text-left shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
                      <span className="block text-[10px] font-medium text-[#1f1f21]">
                        Task Delt Per Hour
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-[#1f1f21]">
                        <span className="size-1 rounded-full bg-[#377dff]" />
                        {hoveredCount} Tasks
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#1f1f21]">
                        <span className="size-1 rounded-full bg-[#377dff]" />
                        {formatDurationLabel(hoveredHours)}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 text-center text-[12px] tracking-[-0.02em] text-[#98a2b3]">
            {DAY_LABELS.map((label, index) => (
              <span key={`${label}-${index}`} className="flex-1">
                {label}
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
}: ShiftProgressProps) {
  const remaining = waiting ?? Math.max(total - completed - inProgress, 0);
  const centerPct =
    progressPercent ??
    Math.round(((completed + inProgress) / Math.max(total, 1)) * 100);

  return (
    <div
      className={cn(
        /* Figma Progress 200:24962 — 425×424 composition */
        "relative h-[424px] w-full overflow-hidden rounded-[10px] border border-[#e7e7e7] bg-white",
        className,
      )}
    >
      {/* Title — Figma x:15 y:29 */}
      <h3 className="absolute left-[15px] top-[29px] text-[22px] font-semibold leading-[27px] tracking-[-0.05em] text-[#1f1f21]">
        Task Progress
      </h3>

      {/* Month pill — Figma x:298 y:25 (15px from right on 425 frame) */}
      <div className="absolute top-[25px] right-[15px]">
        <MonthFilterPill />
      </div>

      {/*
        Total Task — Figma x:15 y:93
        Chart — Figma x:197 y:136 (197/425 ≈ 46.35% so it stays mid-right when card grows)
      */}
      <p className="absolute left-[15px] top-[93px] z-[1] text-[18px] font-semibold leading-[22px] tracking-[-0.05em] text-[#1f1f21]">
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

      {/* Legend — Figma y:385, items spaced like 15 / 148 / 305 */}
      <div className="absolute inset-x-[15px] top-[385px] flex items-center justify-between text-[12px] font-normal leading-[15px] tracking-[-0.05em] text-[#1f1f21]">
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
