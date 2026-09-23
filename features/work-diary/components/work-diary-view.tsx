"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/feedback/empty-state";
import { PresenceTimeline } from "@/features/presence/components/presence-timeline";
import { getTimesheetAction } from "@/features/work-diary/actions";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";

type Mode = "day" | "range";

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHours(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  if (hours === 0 && minutes === 0) return "0h";
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function WorkDiaryView() {
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(utcToday);
  const [from, setFrom] = useState(utcToday);
  const [to, setTo] = useState(utcToday);

  const query = useMemo(() => {
    if (mode === "day") return { date } as const;
    return { from, to } as const;
  }, [mode, date, from, to]);

  const rangeError =
    mode === "range"
      ? from > to
        ? "Start date must be on or before end date."
        : daysInclusive(from, to) > 31
          ? "Date range can be at most 31 days."
          : null
      : null;

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.timesheet.byQuery(query),
    queryFn: async () => {
      const result = await getTimesheetAction(query);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: !rangeError,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (mode === "day") return;
    if (from > to) setTo(from);
  }, [mode, from, to]);

  const periodLabel =
    mode === "day"
      ? date
      : data?.from && data?.to
        ? `${data.from} → ${data.to}`
        : `${from} → ${to}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Work Diary
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setMode("day")}
              className={cn(
                "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-semibold",
                mode === "day"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className={cn(
                "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-semibold",
                mode === "range"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              Range
            </button>
          </div>
          {mode === "day" ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="sr-only">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
              />
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                  From
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                  To
                </span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground"
                />
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={Boolean(rangeError) || isFetching}
            className="h-10 rounded-[var(--radius-md)] border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {rangeError ? (
        <EmptyState title="Invalid range" description={rangeError} />
      ) : null}

      {!rangeError && isPending && !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted"
            />
          ))}
        </div>
      ) : null}

      {!rangeError && isError && !data ? (
        <EmptyState
          title="Can't load Work Diary"
          description={
            error instanceof Error
              ? error.message
              : "Your login is still saved. Refresh and try again."
          }
        />
      ) : null}

      {data ? (
        <>
          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Period
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {data.date ?? periodLabel}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:text-right">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Login
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatStamp(data.loginAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Logout
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {data.logoutAt ? formatStamp(data.logoutAt) : "Still working"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Total Online",
                value: data.totalOnlineHours,
                hint: "Available + Busy",
              },
              {
                label: "Available",
                value: data.availableHours,
                hint: "AVAILABLE status",
              },
              {
                label: "Busy",
                value: data.busyHours,
                hint: "BUSY status",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <p className="text-[12px] font-medium tracking-[-0.02em] text-muted">
                  {card.label}
                </p>
                <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-foreground">
                  {formatHours(card.value)}
                </p>
                <p className="mt-3 text-[11px] text-muted">{card.hint}</p>
              </div>
            ))}
          </section>

          <PresenceTimeline intervals={data.intervals} />
        </>
      ) : null}
    </div>
  );
}
