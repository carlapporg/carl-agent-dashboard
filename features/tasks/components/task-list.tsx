"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { MissedTaskWatcher } from "@/features/tasks/components/missed-task-watcher";
import { useOps } from "@/features/ops/ops-provider";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { themeTokens } from "@/lib/theme/tokens";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import {
  matchesTaskHubFilter,
  taskListStatusChip,
} from "@/features/tasks/lib/workflow";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type HubFilter =
  | "all"
  | "offered"
  | "assigned"
  | "in_progress"
  | "waiting_for_customer"
  | "waiting_for_payment"
  | "completed"
  | "cancelled";

const STATUS_FILTERS: Array<{
  value: HubFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "offered", label: "Offered" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_customer", label: "Waiting on customer" },
  { value: "waiting_for_payment", label: "Waiting on payment" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type TaskListProps = {
  tasks: Task[];
};

function parseHubFilter(raw: string | null): HubFilter {
  const value = (raw as HubFilter) || "all";
  if (STATUS_FILTERS.some((filter) => filter.value === value)) return value;
  if (raw === "failed") return "cancelled";
  if (raw === "queued") return "offered";
  return "all";
}

function matchesFilter(task: Task, filter: HubFilter): boolean {
  return matchesTaskHubFilter(task, filter);
}

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function taskIdLabel(task: Task): string {
  if (task.code?.trim()) return task.code.startsWith("#") ? task.code : `#${task.code}`;
  return `#T-${task.number}`;
}

function categoryLabel(task: Task): string {
  return (
    task.taskType?.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
    "General"
  );
}

function statusVisual(task: Task): { label: string; className: string } {
  return taskListStatusChip(task);
}

function priorityVisual(priority: Task["priority"]): {
  label: string;
  color: string;
} {
  if (priority === "high" || priority === "urgent") {
    return { label: "High", color: themeTokens.priorityHigh };
  }
  if (priority === "low") {
    return { label: "Low", color: themeTokens.priorityLow };
  }
  return { label: "Medium", color: themeTokens.priorityMedium };
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const ops = useOps();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(() =>
    parseHubFilter(searchParams.get("status")),
  );
  const search = searchParams.get("q") ?? "";
  const hasFilters = status !== "all" || Boolean(search.trim());
  const [motionKey, setMotionKey] = useState(0);
  const rejectedTick = useRejectedOfferTick();
  const hydrateOpenTasks = ops?.hydrateOpenTasks;

  useEffect(() => {
    hydrateOpenTasks?.(tasks);
  }, [hydrateOpenTasks, tasks]);

  const allTasks = useMemo(
    () =>
      withoutRejectedOffers(
        mergeTaskLists(tasks, ops?.liveTasks ?? [], ops?.offer),
      ),
    [ops?.liveTasks, ops?.offer, ops?.queuePulse, rejectedTick, tasks],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks.filter((task) => {
      if (!matchesFilter(task, status)) return false;
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        task.customerName.toLowerCase().includes(q) ||
        task.request.toLowerCase().includes(q) ||
        String(task.number).includes(q) ||
        (task.taskType?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allTasks, status, search]);

  useEffect(() => {
    setMotionKey((k) => k + 1);
  }, [status, search]);

  function updateParams(next: Record<string, string>) {
    if (next.status !== undefined) setStatus(parseHubFilter(next.status));
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (!("status" in next)) {
      if (status === "all") params.delete("status");
      else params.set("status", status);
    }
    const qs = params.toString();
    const url = qs ? `${ROUTES.tasks}?${qs}` : ROUTES.tasks;
    if (next.q !== undefined || next.status === undefined) {
      startTransition(() => {
        router.push(url);
      });
      return;
    }
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className={cn("task-card-in space-y-5", pending && "opacity-90")}>
      <MissedTaskWatcher tasks={allTasks} />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => updateParams({ status: filter.value })}
              className={cn(
                "rounded-[var(--radius-pill)] border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-foreground-soft hover:bg-surface-hover",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Active Task Queue
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Showing {visible.length} primary agent assignment
            {visible.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
          <EmptyState
            title={
              hasFilters ? "No tasks match these filters" : "No tasks available"
            }
            description={
              hasFilters
                ? "Try another status or clear your search to see more work."
                : "When customers send requests, they’ll appear in this list."
            }
            action={
              hasFilters ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    updateParams({ status: "all", q: "", type: "all" })
                  }
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="hidden grid-cols-[7rem_minmax(0,1.6fr)_9rem_8.5rem_7rem_8rem] gap-3 border-b border-border px-4 py-3 text-[length:var(--font-size-table-head)] font-semibold uppercase tracking-[var(--letter-table)] text-muted md:grid">
            <span>Task ID</span>
            <span>Title</span>
            <span>Category</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Timestamp</span>
          </div>

          <ul key={motionKey} className="divide-y divide-border">
            {visible.map((task, index) => {
              const statusChip = statusVisual(task);
              const priority = priorityVisual(task.priority);
              return (
                <li
                  key={task.id}
                  className="task-row-in"
                  style={{ "--row-i": index } as CSSProperties}
                >
                  <Link
                    href={ROUTES.task(task.id)}
                    className="grid gap-2 px-4 py-3.5 transition-colors hover:bg-accent-soft/40 md:grid-cols-[7rem_minmax(0,1.6fr)_9rem_8.5rem_7rem_8rem] md:items-center md:gap-3"
                  >
                    <span className="text-sm font-semibold text-accent">
                      {taskIdLabel(task)}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {task.title}
                    </span>
                    <span className="w-fit rounded-[var(--radius-pill)] bg-surface-hover px-2.5 py-1 text-xs font-medium text-foreground-soft">
                      {categoryLabel(task)}
                    </span>
                    <span
                      className={cn(
                        "w-fit rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold",
                        statusChip.className,
                      )}
                    >
                      {statusChip.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-soft">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: priority.color }}
                      />
                      {priority.label}
                    </span>
                    <span className="text-sm text-muted">
                      {formatRelative(task.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
