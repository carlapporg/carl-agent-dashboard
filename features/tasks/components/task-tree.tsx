import Link from "next/link";
import {
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/status-badge";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type TaskTreeProps = {
  parent: Task;
  childTasks: Task[];
  activeId: string;
};

export function TaskTree({ parent, childTasks, activeId }: TaskTreeProps) {
  const nodes = [parent, ...childTasks];

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-dim">
        Task tree
      </p>
      <ul className="space-y-1">
        {nodes.map((task) => {
          const isChild = Boolean(task.parentId);
          const active = task.id === activeId;
          return (
            <li key={task.id}>
              <Link
                href={ROUTES.task(task.id)}
                className={cn(
                  "block rounded-xl border px-3 py-2.5 transition-colors",
                  isChild && "ml-4",
                  active
                    ? "border-accent/40 bg-accent/10"
                    : "border-transparent hover:bg-surface-hover/70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      #{task.number} {task.title}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                {!isChild ? (
                  <div className="mt-2">
                    <PriorityBadge priority={task.priority} />
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
