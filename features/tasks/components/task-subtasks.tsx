import Link from "next/link";
import { StatusBadge } from "@/features/tasks/components/status-badge";
import { checklistProgressPercent } from "@/features/tasks/lib/workflow";
import { ROUTES } from "@/lib/constants/routes";
import type { Task } from "@/types/task";

type TaskSubtasksProps = {
  parent: Task;
  childTasks: Task[];
};

export function TaskSubtasks({ parent, childTasks }: TaskSubtasksProps) {
  if (childTasks.length === 0) return null;

  const done = childTasks.filter((c) => c.status === "completed").length;
  const pct = Math.round((done / childTasks.length) * 100);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Subtasks</h2>
        <p className="text-sm tabular-nums text-muted">
          {done}/{childTasks.length} · {pct}%
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Parent #{parent.number} · same agent owns these
      </p>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-3 space-y-2">
        {childTasks.map((child) => (
          <li key={child.id}>
            <Link
              href={ROUTES.task(child.id)}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-accent/35"
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                #{child.number} {child.title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-xs text-muted">
                  {checklistProgressPercent(child)}%
                </span>
                <StatusBadge status={child.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
