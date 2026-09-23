"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { TimesheetInterval, TimesheetStatus } from "@/types/timesheet";

type FilterId = "AVAILABLE" | "BUSY" | "OFFLINE";

const FILTERS: Array<{
  id: FilterId;
  label: string;
  hint: string;
  activeClass: string;
  idleClass: string;
  badgeClass: string;
}> = [
  {
    id: "AVAILABLE",
    label: "Active",
    hint: "Counts toward hours",
    activeClass: "border-success bg-success-soft text-success-foreground",
    idleClass: "border-border bg-surface text-muted hover:text-foreground",
    badgeClass: "bg-success-soft text-success-foreground",
  },
  {
    id: "BUSY",
    label: "Busy",
    hint: "Counts toward hours",
    activeClass: "border-warning bg-warning-soft text-warning-foreground",
    idleClass: "border-border bg-surface text-muted hover:text-foreground",
    badgeClass: "bg-warning-soft text-warning-foreground",
  },
  {
    id: "OFFLINE",
    label: "Offline",
    hint: "Does not count hours",
    activeClass: "border-danger bg-danger-soft text-danger",
    idleClass: "border-border bg-surface text-muted hover:text-foreground",
    badgeClass: "bg-danger-soft text-danger",
  },
];

function formatClock(iso: string | null): string {
  if (!iso) return "Now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }
  const minutes = Math.round((end - start) / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function sourceLabel(source: string): string {
  if (!source) return "";
  return source.replace(/_/g, " ");
}

function IntervalLog({
  row,
  badgeClass,
}: {
  row: TimesheetInterval;
  badgeClass: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-3 sm:px-4">
      <div
        className={cn(
          "mt-0.5 size-2.5 shrink-0 rounded-full",
          row.status === "AVAILABLE" && "bg-success",
          row.status === "BUSY" && "bg-warning",
          row.status === "OFFLINE" && "bg-danger",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]",
              badgeClass,
            )}
          >
            {row.status === "AVAILABLE"
              ? "Active"
              : row.status === "BUSY"
                ? "Busy"
                : "Offline"}
          </span>
          <span className="text-[12px] font-semibold text-foreground">
            {formatDuration(row.startedAt, row.endedAt)}
          </span>
          {!row.endedAt ? (
            <span className="text-[11px] font-medium text-accent">Open</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm font-medium text-foreground">
          {formatClock(row.startedAt)}
          <span className="mx-1.5 text-muted">→</span>
          {formatClock(row.endedAt)}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {formatDay(row.startedAt)}
          {row.source ? ` · ${sourceLabel(row.source)}` : ""}
        </p>
      </div>
    </li>
  );
}

export function PresenceTimeline({
  intervals,
}: {
  intervals: TimesheetInterval[];
}) {
  const [filter, setFilter] = useState<FilterId>("AVAILABLE");

  const counts = useMemo(() => {
    const next: Record<FilterId, number> = {
      AVAILABLE: 0,
      BUSY: 0,
      OFFLINE: 0,
    };
    for (const row of intervals) {
      if (row.status in next) {
        next[row.status as FilterId] += 1;
      }
    }
    return next;
  }, [intervals]);

  const filtered = useMemo(
    () => intervals.filter((row) => row.status === filter),
    [intervals, filter],
  );

  const active = FILTERS.find((item) => item.id === filter)!;

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Presence log
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Pick a status to see every time you were in that state.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {FILTERS.map((item) => {
          const selected = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors",
                selected ? item.activeClass : item.idleClass,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{item.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    selected ? "bg-white/50" : "bg-surface-muted text-muted",
                  )}
                >
                  {counts[item.id]}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  selected ? "opacity-80" : "text-muted",
                )}
              >
                {item.hint}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {intervals.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No presence intervals for this period.
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No {active.label.toLowerCase()} periods in this range.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((row, index) => (
              <IntervalLog
                key={`${row.status}-${row.startedAt}-${index}`}
                row={row}
                badgeClass={active.badgeClass}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Keep type export used by callers that previously imported status helpers. */
export type PresenceFilterStatus = Extract<
  TimesheetStatus,
  "AVAILABLE" | "BUSY" | "OFFLINE"
>;
