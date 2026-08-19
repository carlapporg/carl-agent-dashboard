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
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import {
  MiniRing,
  stageProgressPercent,
  TASK_STAGES,
} from "@/features/tasks/components/stage-progress";
import { TaskBoard } from "@/features/tasks/components/task-board";
import {
  readStoredTasksView,
  storeTasksView,
  TaskViewToggle,
  type TasksViewMode,
} from "@/features/tasks/components/task-view-toggle";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_FILTERS: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_customer", label: "Waiting on customer" },
  { value: "waiting_for_payment", label: "Waiting on payment" },
  { value: "completed", label: "Completed" },
];

type TaskListProps = {
  tasks: Task[];
};

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const status = (searchParams.get("status") as TaskStatus | "all") || "all";
  const search = searchParams.get("q") ?? "";
  const hasFilters = status !== "all" || Boolean(search.trim());
  const [motionKey, setMotionKey] = useState(0);
  const [bounceFilter, setBounceFilter] = useState<string | null>(null);
  const [view, setView] = useState<TasksViewMode>("list");
  const [viewReady, setViewReady] = useState(false);

  useEffect(() => {
    setView(readStoredTasksView());
    setViewReady(true);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };
    for (const filter of STATUS_FILTERS) {
      if (filter.value === "all") continue;
      counts[filter.value] = 0;
    }
    for (const task of tasks) {
      if (counts[task.status] != null) counts[task.status] += 1;
    }
    return counts;
  }, [tasks]);

  const distribution = useMemo(() => {
    const total = Math.max(tasks.length, 1);
    return TASK_STAGES.map((stage) => {
      const count = tasks.filter((t) => t.status === stage.status).length;
      return {
        ...stage,
        count,
        pct: Math.round((count / total) * 100),
      };
    });
  }, [tasks]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status !== "all" && task.status !== status) return false;
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        task.customerName.toLowerCase().includes(q) ||
        task.request.toLowerCase().includes(q) ||
        String(task.number).includes(q)
      );
    });
  }, [tasks, status, search]);

  useEffect(() => {
    setMotionKey((k) => k + 1);
  }, [status, search]);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.push(`${ROUTES.tasks}?${params.toString()}`);
    });
  }

  function changeView(mode: TasksViewMode) {
    setView(mode);
    storeTasksView(mode);
  }

  return (
    <div className={cn("task-card-in space-y-4", pending && "opacity-90")}>
      <Card className="p-3 md:px-4 md:py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn(!viewReady && "invisible")}>
              <TaskViewToggle value={view} onChange={changeView} />
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

          <div className="flex min-w-0 flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = status === filter.value;
              const count = statusCounts[filter.value] ?? 0;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setBounceFilter(filter.value);
                    window.setTimeout(() => setBounceFilter(null), 400);
                    updateParams({ status: filter.value });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-accent bg-accent text-accent-foreground shadow-sm"
                      : "border-border bg-surface text-foreground-soft hover:border-accent/35 hover:text-accent",
                    bounceFilter === filter.value && "task-chip-bounce",
                  )}
                >
                  {active ? <CheckIcon className="opacity-95" /> : null}
                  <span>
                    {filter.label} {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Queue health
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
            <span className="dash-live-dot size-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {distribution.map((stage, index) => (
            <div
              key={stage.status}
              className="task-health-in rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-card)]"
              style={{ "--health-i": index } as CSSProperties}
            >
              <p className="truncate text-sm font-medium text-muted">
                {stage.label}
              </p>
              <p
                key={`${motionKey}-${stage.status}-n`}
                className="task-count-pop mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground"
              >
                {stage.count}
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-hover">
                <div
                  key={`${motionKey}-${stage.status}-bar`}
                  className="dash-progress-fill h-full rounded-full"
                  style={{
                    width: `${stage.count > 0 ? Math.max(stage.pct, 18) : 0}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

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
                  onClick={() => updateParams({ status: "all", q: "" })}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[48px_minmax(0,1.8fr)_minmax(0,0.9fr)_100px_160px_80px_80px] gap-2 border-b border-border bg-[#f8fafc] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted xl:grid">
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
                    className="group relative grid gap-2 px-3 py-3 transition-colors hover:bg-accent/[0.04] sm:px-4 xl:grid-cols-[48px_minmax(0,1.8fr)_minmax(0,0.9fr)_100px_160px_80px_80px] xl:items-center"
                  >
                    <span className="absolute inset-y-3 left-0 w-0 rounded-r bg-accent transition-[width] duration-200 group-hover:w-1" />

                    <div className="relative hidden size-10 xl:block">
                      <MiniRing
                        percent={pct}
                        color={color}
                        size={40}
                        animate
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-foreground">
                        {pct}%
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-muted">
                          #{task.number}
                        </span>
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {task.title}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted">
                        {task.request}
                      </p>
                    </div>

                    <div className="hidden min-w-0 xl:block">
                      <p className="truncate text-sm font-medium text-foreground">
                        {task.customerName}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:contents">
                      <div className="xl:hidden">
                        <div className="relative inline-flex size-9">
                          <MiniRing
                            percent={pct}
                            color={color}
                            size={36}
                            animate
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                            {pct}%
                          </span>
                        </div>
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
