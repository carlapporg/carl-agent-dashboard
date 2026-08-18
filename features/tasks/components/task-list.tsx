"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
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

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const status = (searchParams.get("status") as TaskStatus | "all") || "all";
  const search = searchParams.get("q") ?? "";
  const hasFilters = status !== "all" || Boolean(search.trim());

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

  return (
    <div className={cn("space-y-6", pending && "opacity-80")}>
      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">
                Task queue
              </p>
              <p className="mt-1 text-base text-muted">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"} shown
                {hasFilters ? " with current filters" : ""}
              </p>
            </div>
            <Input
              defaultValue={search}
              placeholder="Search by task, customer, or request…"
              className="w-full sm:max-w-md"
              aria-label="Search tasks"
              onChange={(event) => {
                const value = event.target.value;
                window.clearTimeout(
                  (window as unknown as { __taskSearch?: number }).__taskSearch,
                );
                (window as unknown as { __taskSearch?: number }).__taskSearch =
                  window.setTimeout(() => updateParams({ q: value }), 250);
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => updateParams({ status: filter.value })}
                className={cn(
                  "rounded-full border px-4 py-2 text-base font-medium transition-colors",
                  status === filter.value
                    ? "border-accent bg-accent text-accent-foreground shadow-sm"
                    : "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {tasks.length === 0 ? (
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
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_140px_180px_150px_88px] gap-4 border-b border-border bg-surface-hover/70 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-muted lg:grid">
            <span>Task</span>
            <span>Customer</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Updated</span>
            <span className="text-right">Action</span>
          </div>

          <ul className="divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={ROUTES.task(task.id)}
                  className="grid gap-4 px-5 py-5 transition-colors hover:bg-accent/[0.04] sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_140px_180px_150px_88px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-surface-hover px-2 py-0.5 text-sm font-medium text-muted">
                        #{task.number}
                      </span>
                      <p className="text-lg font-semibold leading-snug text-foreground">
                        {task.title}
                      </p>
                    </div>
                    <p className="mt-2 line-clamp-2 text-base leading-relaxed text-muted lg:hidden">
                      {task.customerName} · {task.request}
                    </p>
                    <p className="mt-2 hidden text-base leading-relaxed text-muted lg:line-clamp-2">
                      {task.request}
                    </p>
                  </div>

                  <div className="hidden min-w-0 lg:block">
                    <p className="truncate text-base font-medium text-foreground">
                      {task.customerName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:contents">
                    <div>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <div>
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="hidden text-base text-muted lg:block">
                      {formatUpdated(task.updatedAt)}
                    </p>
                    <div className="lg:text-right">
                      <span className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-accent">
                        Open
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
