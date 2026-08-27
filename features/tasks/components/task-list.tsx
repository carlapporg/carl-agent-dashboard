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
import { SlaCountdown } from "@/features/dashboard/components/sla-countdown";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import {
  MiniRingLabel,
  stageProgressPercent,
  TASK_STAGES,
} from "@/features/tasks/components/stage-progress";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { MissedTaskWatcher } from "@/features/tasks/components/missed-task-watcher";
import {
  readStoredTasksView,
  storeTasksView,
  TaskViewToggle,
  type TasksViewMode,
} from "@/features/tasks/components/task-view-toggle";
import { useOps } from "@/features/ops/ops-provider";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants/routes";
import { mergeTaskLists } from "@/lib/tasks/merge-live-task";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_FILTERS: Array<{
  value: TaskStatus | "all";
  label: string;
  match: TaskStatus[];
}> = [
  { value: "all", label: "All", match: [] },
  {
    value: "assigned",
    label: "Assigned",
    match: ["assigned"],
  },
  {
    value: "in_progress",
    label: "In progress",
    match: ["in_progress"],
  },
  {
    value: "waiting_for_customer",
    label: "Waiting on customer",
    match: ["waiting_for_customer"],
  },
  {
    value: "waiting_for_payment",
    label: "Waiting on payment",
    match: ["waiting_for_payment"],
  },
  {
    value: "completed",
    label: "Completed",
    match: ["completed"],
  },
  {
    value: "failed",
    label: "Failed",
    match: ["failed"],
  },
  {
    value: "cancelled",
    label: "Cancelled",
    match: ["cancelled"],
  },
];

type TaskListProps = {
  tasks: Task[];
};

function parseStatusFilter(raw: string | null): TaskStatus | "all" {
  const value = (raw as TaskStatus | "all") || "all";
  if (value === "queued" || !STATUS_FILTERS.some((filter) => filter.value === value)) {
    return "all";
  }
  return value;
}

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stageColor(status: TaskStatus): string {
  return (
    TASK_STAGES.find((s) => s.status === status)?.color ??
    (status === "failed" ? "#dc2626" : "#9ca3af")
  );
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const ops = useOps();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(() =>
    parseStatusFilter(searchParams.get("status")),
  );
  const search = searchParams.get("q") ?? "";
  const hasFilters = status !== "all" || Boolean(search.trim());
  const [motionKey, setMotionKey] = useState(0);
  const [view, setView] = useState<TasksViewMode>("list");
  const [viewReady, setViewReady] = useState(false);

  const rejectedTick = useRejectedOfferTick();
  const allTasks = useMemo(
    () =>
      withoutRejectedOffers(
        mergeTaskLists(tasks, ops?.liveTasks ?? [], ops?.offer),
      ),
    [ops?.liveTasks, ops?.offer, rejectedTick, tasks],
  );

  useEffect(() => {
    setView(readStoredTasksView());
    setViewReady(true);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTasks.length };
    for (const filter of STATUS_FILTERS) {
      if (filter.value === "all") continue;
      counts[filter.value] = 0;
    }
    for (const task of allTasks) {
      for (const filter of STATUS_FILTERS) {
        if (filter.value === "all") continue;
        if (filter.match.includes(task.status)) counts[filter.value] += 1;
      }
    }
    return counts;
  }, [allTasks]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeFilter = STATUS_FILTERS.find((f) => f.value === status);
    return allTasks.filter((task) => {
      if (status !== "all" && !activeFilter?.match.includes(task.status)) {
        return false;
      }
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
    if (next.status !== undefined) setStatus(parseStatusFilter(next.status));
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

  function changeView(mode: TasksViewMode) {
    setView(mode);
    storeTasksView(mode);
  }

  return (
    <div className={cn("task-card-in space-y-4", pending && "opacity-90")}>
      <MissedTaskWatcher tasks={allTasks} />
      <Card className="p-3 md:px-4 md:py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn("flex flex-wrap items-center gap-2", !viewReady && "invisible")}>
              <TaskViewToggle value={view} onChange={changeView} />
              <select
                id="task-status-filter"
                value={status}
                aria-label="Filter by status"
                onChange={(event) => {
                  updateParams({ status: event.target.value, type: "all" });
                }}
                className={cn(
                  "h-[length:var(--control-height)] min-w-[11.5rem] rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground outline-none",
                  "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
                )}
              >
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                    {filter.value === "all"
                      ? ` (${statusCounts.all ?? 0})`
                      : ` (${statusCounts[filter.value] ?? 0})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-dim"
                aria-hidden
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <Input
                defaultValue={search}
                placeholder="Search tasks, customers…"
                className="pl-10"
                aria-label="Search tasks"
                onChange={(event) => {
                  const value = event.target.value;
                  window.clearTimeout(
                    (window as unknown as { __taskSearch?: number })
                      .__taskSearch,
                  );
                  (
                    window as unknown as { __taskSearch?: number }
                  ).__taskSearch = window.setTimeout(
                    () => updateParams({ q: value }),
                    250,
                  );
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {view === "board" ? (
        <TaskBoard tasks={visible} />
      ) : visible.length === 0 ? (
        <Card className="p-6">
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
                  onClick={() => updateParams({ status: "all", q: "", type: "all" })}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[56px_minmax(0,1.8fr)_minmax(0,0.9fr)_100px_160px_80px_80px] gap-2 border-b border-border bg-[#f8fafc] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted xl:grid">
            <span>Prog</span>
            <span>Task</span>
            <span>Customer</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Updated</span>
            <span className="text-right">Action</span>
          </div>

          <ul key={motionKey} className="divide-y divide-border">
            {visible.map((task, index) => {
              const pct = stageProgressPercent(task.status);
              const color = stageColor(task.status);
              return (
                <li
                  key={task.id}
                  className="task-row-in task-row-shimmer"
                  style={{ "--row-i": index } as CSSProperties}
                >
                  <Link
                    href={ROUTES.task(task.id)}
                    className="group relative grid gap-2 px-3 py-3 transition-colors hover:bg-accent/[0.04] sm:px-4 xl:grid-cols-[56px_minmax(0,1.8fr)_minmax(0,0.9fr)_100px_160px_80px_80px] xl:items-center"
                  >
                    <span className="absolute inset-y-3 left-0 w-0 rounded-r bg-accent transition-[width] duration-200 group-hover:w-1" />

                    <div className="hidden xl:flex xl:justify-center">
                      <MiniRingLabel
                        percent={pct}
                        color={color}
                        size={44}
                        animate
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {task.taskType ? (
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                            {task.taskType}
                          </span>
                        ) : null}
                        {task.tier === "vip" || task.tier === "family" ? (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                            {task.tier.toUpperCase()}
                          </span>
                        ) : null}
                        {task.expiresAt ? (
                          <SlaCountdown expiresAt={task.expiresAt} />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-muted">
                          #{task.number}
                        </span>
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {task.title}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted">
                        {task.aiBrief?.summary ?? task.request}
                      </p>
                    </div>

                    <div className="hidden min-w-0 xl:block">
                      <p className="truncate text-sm font-medium text-foreground">
                        {task.customerName}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:contents">
                      <div className="xl:hidden">
                        <MiniRingLabel
                          percent={pct}
                          color={color}
                          size={40}
                          animate
                        />
                      </div>
                      <p className="text-sm text-muted xl:hidden">
                        {task.customerName}
                      </p>
                      <div>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <div>
                        <StatusBadge status={task.status} withDot />
                      </div>
                      <p className="text-sm tabular-nums text-muted">
                        {formatRelative(task.updatedAt)}
                      </p>
                      <div className="xl:text-right">
                        <span className="inline-flex h-8 items-center rounded-full bg-accent/10 px-3 text-sm font-semibold text-accent transition-all group-hover:bg-accent group-hover:text-accent-foreground">
                          Open
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
