"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  type ActivityLogFilter,
  type ActivityLogItem,
  type ActivityLogKind,
} from "@/lib/api/activity-logs";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

type HistoryViewProps = {
  logs: ActivityLogItem[];
};

const FILTERS: Array<{ value: ActivityLogFilter; label: string }> = [
  { value: "all", label: "All Activity" },
  { value: "system", label: "System Alerts" },
  { value: "handover", label: "Agent Hand-Over" },
];

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date >= startToday) return `Today, ${time}`;
  if (date >= startYesterday) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesFilter(item: ActivityLogItem, filter: ActivityLogFilter) {
  if (filter === "all") return true;
  if (filter === "system") {
    return (
      item.kind === "system" ||
      item.kind === "alert" ||
      item.kind === "voucher"
    );
  }
  return item.kind === "handover";
}

function KindIcon({ kind }: { kind: ActivityLogKind }) {
  const common =
    "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent";
  switch (kind) {
    case "payment":
      return (
        <span className={common} aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M3 10h18" />
          </svg>
        </span>
      );
    case "handover":
      return (
        <span className={common} aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 19c.8-2.5 2.7-4 6-4" />
            <path d="M16 11h5M18.5 8.5 21 11l-2.5 2.5" />
          </svg>
        </span>
      );
    case "system":
      return (
        <span className={common} aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
      );
    case "alert":
      return (
        <span className={common} aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 9v4M12 17h.01M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
      );
    case "voucher":
      return (
        <span className={common} aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M7 10V7a5 5 0 0 1 10 0v3" />
            <rect x="5" y="10" width="14" height="10" rx="2" />
          </svg>
        </span>
      );
    default:
      return (
        <span className={common} aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 12h4l2-6 4 12 2-6h4" />
          </svg>
        </span>
      );
  }
}

export function HistoryView({ logs }: HistoryViewProps) {
  const [filter, setFilter] = useState<ActivityLogFilter>("all");

  const visible = useMemo(
    () => logs.filter((item) => matchesFilter(item, filter)),
    [filter, logs],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-[var(--radius-pill)] border px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-white"
                  : "border-border bg-surface text-foreground hover:bg-surface-hover",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Workspace events and audit trails will appear here."
        />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-6">
          <ul className="relative space-y-0">
            <span
              className="absolute bottom-4 left-5 top-4 w-px bg-border"
              aria-hidden
            />
            {visible.map((item) => {
              const href = item.taskId ? ROUTES.task(item.taskId) : null;
              const body = (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {item.body}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-muted">
                        Task: {item.taskLabel ?? "N/A"}
                      </span>
                      <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-muted">
                        By: {item.actor}
                      </span>
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-muted-dim sm:pt-0.5">
                    {formatLogTime(item.at)}
                  </time>
                </div>
              );

              return (
                <li key={item.id} className="relative flex gap-4 py-4">
                  <KindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link
                        href={href}
                        className="block rounded-[var(--radius-md)] transition-colors hover:bg-accent-soft/40"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
