import Link from "next/link";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import {
  MiniRing,
  stageProgressPercent,
  TASK_STAGES,
} from "@/features/tasks/components/stage-progress";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type TaskTreeProps = {
  parent: Task;
  childTasks: Task[];
  activeId: string;
};

function colorFor(status: Task["status"]): string {
  return (
    TASK_STAGES.find((s) => s.status === status)?.color ??
    (status === "failed" ? "#dc2626" : "#9ca3af")
  );
}

export function TaskTree({ parent, childTasks, activeId }: TaskTreeProps) {
  const nodes = [parent, ...childTasks];
  const doneChildren = childTasks.filter((c) => c.status === "completed").length;
  const childPct =
    childTasks.length > 0
      ? Math.round((doneChildren / childTasks.length) * 100)
      : stageProgressPercent(parent.status);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
          Task tree
        </p>
        {childTasks.length > 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface-hover/50 px-3 py-3">
            <div className="relative">
              <MiniRing percent={childPct} color="var(--accent)" size={48} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                {childPct}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Subtasks {doneChildren}/{childTasks.length}
              </p>
              <p className="text-sm text-muted">Parent trip progress</p>
            </div>
          </div>
        ) : null}
      </div>

      <ul className="space-y-2">
        {nodes.map((task) => {
          const isChild = Boolean(task.parentId);
          const active = task.id === activeId;
          const pct = stageProgressPercent(task.status);
          return (
            <li key={task.id}>
              <Link
                href={ROUTES.task(task.id)}
                className={cn(
                  "block rounded-xl border px-3 py-3 transition-colors",
                  isChild && "ml-3",
                  active
                    ? "border-accent/40 bg-accent/10"
                    : "border-border hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <MiniRing
                      percent={pct}
                      color={colorFor(task.status)}
                      size={40}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {pct}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      #{task.number} {task.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <StatusBadge status={task.status} />
                      {!isChild ? (
                        <PriorityBadge priority={task.priority} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
