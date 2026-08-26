"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useRejectedOfferTick,
  withoutRejectedOffers,
} from "@/features/ops/rejected-offers";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskStatus } from "@/types/task";

type HistoryFilter = "all" | Extract<TaskStatus, "completed" | "failed" | "cancelled">;

const FILTERS: Array<{ value: HistoryFilter; label: string; color: string }> = [
  { value: "all", label: "All", color: "#4f7cff" },
  { value: "completed", label: "Completed", color: "#10b981" },
  { value: "failed", label: "Failed", color: "#dc2626" },
  { value: "cancelled", label: "Cancelled", color: "#6b7280" },
];

type HistoryViewProps = {
  tasks: Task[];
};

export function HistoryView({ tasks }: HistoryViewProps) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<HistoryFilter>("all");
  const rejectedTick = useRejectedOfferTick();
  const visibleTasks = useMemo(
    () => withoutRejectedOffers(tasks),
    [rejectedTick, tasks],
  );

  const counts = useMemo(() => {
    const next: Record<HistoryFilter, number> = {
      all: visibleTasks.length,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const task of visibleTasks) {
      if (task.status === "completed") next.completed += 1;
      if (task.status === "failed") next.failed += 1;
      if (task.status === "cancelled") next.cancelled += 1;
    }
    return next;
  }, [visibleTasks]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibleTasks.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.request.toLowerCase().includes(needle) ||
        t.customerName.toLowerCase().includes(needle) ||
        String(t.number).includes(needle)
      );
    });
  }, [visibleTasks, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface text-foreground hover:border-accent/30 hover:text-accent",
                )}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: filter.color }}
                  aria-hidden
                />
                {filter.label}
                <span className={cn("tabular-nums", active ? "text-accent" : "text-muted")}>
                  {counts[filter.value]}
                </span>
              </button>
            );
          })}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search history…"
          aria-label="Search history"
          className="max-w-md"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            visibleTasks.length === 0
              ? "No finished tasks"
              : "No tasks match these filters"
          }
          description={
            visibleTasks.length === 0
              ? "Completed, failed, and cancelled work will show up here."
              : "Try another status or clear your search."
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {filtered.map((task) => (
              <li key={task.id}>
                <Link
                  href={`${ROUTES.task(task.id)}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/[0.04] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      #{task.number} {task.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">
                      {task.customerName} ·{" "}
                      {task.completedAt
                        ? new Date(task.completedAt).toLocaleDateString()
                        : new Date(task.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} />
                    <span className="text-sm font-semibold text-accent">
                      View
                    </span>
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
