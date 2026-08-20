import {
  currentStageId,
  overallProgressPercent,
  workflowStagesForTask,
} from "@/features/tasks/lib/workflow";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type TaskProgressProps = {
  task: Task;
};

/** Compact progress (board/list helpers). Workspace uses TaskStatusStepper. */
export function TaskProgress({ task }: TaskProgressProps) {
  const stages = workflowStagesForTask(task);
  const current = currentStageId(task);
  const pct = overallProgressPercent(task);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Progress</h2>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {pct}%
        </p>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Task progress"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2">
        {stages.slice(0, 3).map((stage) => {
          const active = current === stage.id;
          return (
            <li
              key={stage.id}
              className={cn(
                "rounded-lg border px-2 py-2 text-center text-sm",
                active && "border-accent bg-accent/5 font-medium text-foreground",
                !active && "border-border text-muted",
              )}
            >
              {stage.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
