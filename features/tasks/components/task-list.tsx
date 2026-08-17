"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_FILTERS: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_customer", label: "Waiting customer" },
  { value: "waiting_for_payment", label: "Waiting payment" },
  { value: "completed", label: "Completed" },
];

type TaskListProps = {
  tasks: Task[];
};

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const status = (searchParams.get("status") as TaskStatus | "all") || "all";
  const search = searchParams.get("q") ?? "";

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => updateParams({ status: filter.value })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                status === filter.value
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <Input
          defaultValue={search}
          placeholder="Search tasks or customers"
          className="max-w-sm"
          onChange={(event) => {
            const value = event.target.value;
            window.clearTimeout((window as unknown as { __taskSearch?: number }).__taskSearch);
            (window as unknown as { __taskSearch?: number }).__taskSearch =
              window.setTimeout(() => updateParams({ q: value }), 250);
          }}
        />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks match"
          description="Try another filter, or wait for the next customer request."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={ROUTES.task(task.id)}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-hover/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-dim">#{task.number}</span>
                    <p className="truncate font-medium text-foreground">
                      {task.title}
                    </p>
                  </div>
                  <p className="truncate text-sm text-muted">
                    {task.customerName} · {task.request}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
