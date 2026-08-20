"use client";

import Link from "next/link";
import {
  currentStageId,
  overallProgressPercent,
  workflowStagesForTask,
} from "@/features/tasks/lib/workflow";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/types/task";

type TaskStatusStepperProps = {
  task: Task;
  parent?: Task | null;
  compact?: boolean;
};

export function TaskStatusStepper({
  task,
  parent,
  compact = false,
}: TaskStatusStepperProps) {
  const stages = workflowStagesForTask(task);
  const current = currentStageId(task);
  const pct = overallProgressPercent(task);
  const currentLabel =
    stages.find((s) => s.id === current)?.label ?? phaseFallback(task);

  if (compact) {
    return (
      <div className="space-y-2">
        {parent ? (
          <p className="text-sm text-muted">
            Part of{" "}
            <Link
              href={ROUTES.task(parent.id)}
              className="font-semibold text-accent hover:text-accent-hover"
            >
              #{parent.number} {parent.title}
            </Link>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Status ·{" "}
            <span className="font-semibold text-foreground">{currentLabel}</span>
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {pct}%
          </p>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-hover"
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
      </div>
    );
  }

  return (
    <section className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Status</h2>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {pct}%
        </p>
      </div>

      {parent ? (
        <p className="mt-2 text-sm text-muted">
          Part of{" "}
          <Link
            href={ROUTES.task(parent.id)}
            className="font-semibold text-accent hover:text-accent-hover"
          >
            #{parent.number} {parent.title}
          </Link>
        </p>
      ) : null}

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hover"
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

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((stage) => {
          const active = current === stage.id;
          return (
            <li
              key={stage.id}
              className={cn(
                "rounded-lg border px-2 py-2 text-center text-xs font-medium sm:text-sm",
                active
                  ? "border-accent bg-accent/5 text-foreground"
                  : "border-border text-muted",
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

function phaseFallback(task: Task): string {
  return task.status.replaceAll("_", " ");
}
