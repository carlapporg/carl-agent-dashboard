"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleStepAction } from "@/features/tasks/actions/task-actions";
import {
  checklistProgressPercent,
  checklistSteps,
} from "@/features/tasks/lib/workflow";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type TaskChecklistProps = {
  task: Task;
  /** Steps can only be marked after Start task */
  locked?: boolean;
};

export function TaskChecklist({ task, locked = false }: TaskChecklistProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const steps = checklistSteps(task);
  const pct = checklistProgressPercent(task);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Task steps</h2>
        <p className="text-xs font-medium tabular-nums text-muted">
          {pct}% done
        </p>
      </div>

      {locked ? (
        <p className="mt-2 text-sm text-muted">
          Click Start task above, then check off each step as you finish it.
        </p>
      ) : null}

      <ul className="mt-3 space-y-1">
        {steps.map((step) => {
          const done = task.suggestedStepsDone.includes(step);
          return (
            <li key={step}>
              <button
                type="button"
                disabled={pending || locked}
                onClick={() => {
                  startTransition(async () => {
                    await toggleStepAction(task.id, step);
                    router.refresh();
                  });
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors",
                  locked
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-surface-hover disabled:opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs font-bold",
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-border bg-surface text-transparent",
                  )}
                  aria-hidden
                >
                  ✓
                </span>
                <span
                  className={cn(
                    "leading-snug",
                    done
                      ? "text-muted line-through"
                      : "text-foreground-soft",
                  )}
                >
                  {step}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
