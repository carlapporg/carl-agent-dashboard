import Link from "next/link";
import {
  acceptTaskAction,
  updateTaskStatusAction,
} from "@/features/tasks/actions/task-actions";
import { AskQuestionPanel } from "@/features/tasks/components/ask-question-panel";
import {
  PriorityBadge,
  StatusBadge,
  formatStatus,
} from "@/features/tasks/components/status-badge";
import {
  MiniRing,
  stageProgressPercent,
  TASK_STAGES,
} from "@/features/tasks/components/stage-progress";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { TimelineEvent } from "@/types/message";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_OPTIONS: TaskStatus[] = [
  "queued",
  "assigned",
  "in_progress",
  "waiting_for_customer",
  "waiting_for_payment",
  "completed",
  "cancelled",
];

type TaskBriefPaneProps = {
  task: Task;
  timeline: TimelineEvent[];
};

export function TaskBriefPane({ task, timeline }: TaskBriefPaneProps) {
  const pct = stageProgressPercent(task.status);
  const color =
    TASK_STAGES.find((s) => s.status === task.status)?.color ?? "#4f7cff";

  return (
    <div className="space-y-5">
      <Link
        href={ROUTES.tasks}
        className="inline-flex items-center gap-1.5 text-base font-semibold text-accent hover:text-accent-hover"
      >
        ← Back to tasks
      </Link>

      <Card>
        <CardBody className="p-6 md:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-md bg-surface-hover px-3 py-1 text-base font-semibold text-muted">
                  #{task.number}
                </span>
                <StatusBadge status={task.status} withDot />
                <PriorityBadge priority={task.priority} />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {task.title}
              </h1>
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted">
                {task.request}
              </p>
              <p className="mt-3 text-base text-muted">
                Customer ·{" "}
                <span className="font-semibold text-foreground-soft">
                  {task.customerName}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div className="relative hidden size-16 sm:block">
                <MiniRing percent={pct} color={color} size={64} />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.status === "queued" ? (
                  <form action={acceptTaskAction.bind(null, task.id)}>
                    <Button type="submit">Accept task</Button>
                  </form>
                ) : null}
                <Link href={ROUTES.taskPayments(task.id)}>
                  <Button type="button" variant="secondary">
                    Payments
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-5">
          <Card>
            <CardBody className="p-6 md:p-7">
              <h2 className="text-lg font-semibold text-foreground">Brief</h2>
              {task.aiBrief ? (
                <p className="mt-3 text-lg leading-relaxed text-foreground-soft">
                  {task.aiBrief.summary}
                </p>
              ) : (
                <p className="mt-3 text-lg text-muted">
                  No AI brief yet for this task.
                </p>
              )}

              {task.aiBrief?.missingInfo &&
              task.aiBrief.missingInfo.length > 0 ? (
                <div className="mt-5">
                  <p className="text-base font-semibold text-amber-800">
                    Still needed
                  </p>
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {task.aiBrief.missingInfo.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-base text-amber-900"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6 md:p-7">
              <h2 className="text-lg font-semibold text-foreground">
                Update status
              </h2>
              <p className="mt-1 text-base text-muted">
                Move the task when something changes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((next) => {
                  const active = task.status === next;
                  const stageColor =
                    TASK_STAGES.find((s) => s.status === next)?.color ??
                    "#9ca3af";
                  return (
                    <form
                      key={next}
                      action={updateTaskStatusAction.bind(null, task.id, next)}
                    >
                      <button
                        type="submit"
                        className={cn(
                          "inline-flex h-10 items-center rounded-full border px-3.5 text-base font-semibold transition-colors",
                          active
                            ? "border-transparent text-white shadow-sm"
                            : "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground",
                        )}
                        style={
                          active ? { backgroundColor: stageColor } : undefined
                        }
                      >
                        {formatStatus(next)}
                      </button>
                    </form>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        <AskQuestionPanel
          taskId={task.id}
          timeline={timeline}
          suggestedQuestions={task.aiBrief?.missingInfo ?? []}
        />
      </div>
    </div>
  );
}
