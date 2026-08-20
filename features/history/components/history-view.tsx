"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/features/tasks/components/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants/routes";
import type { Task } from "@/types/task";

type HistoryViewProps = {
  tasks: Task[];
};

export function HistoryView({ tasks }: HistoryViewProps) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.request.toLowerCase().includes(needle) ||
        t.customerName.toLowerCase().includes(needle) ||
        String(t.number).includes(needle),
    );
  }, [tasks, q]);

  return (
    <div className="space-y-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search completed tasks…"
        aria-label="Search history"
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No completed tasks"
          description="Finished work will archive here. Reopen is not available yet."
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
                        : "—"}
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
