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
  "waiting_for_payment",
  "completed",
  "failed",
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
    <div className="space-y-4">
      <Link
        href={ROUTES.tasks}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover"
      >
        ← Back to tasks
      </Link>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-surface-hover px-2.5 py-0.5 text-sm font-semibold text-muted">
                  #{task.number}
                </span>
                <StatusBadge status={task.status} withDot />
                <PriorityBadge priority={task.priority} />
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {task.title}
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
                {task.request}
              </p>
              <p className="mt-2 text-sm text-muted">
                Customer ·{" "}
                <span className="font-semibold text-foreground-soft">
                  {task.customerName}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="relative hidden size-14 sm:block">
                <MiniRing percent={pct} color={color} size={56} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.status === "queued" ? (
                  <form
                    action={async () => {
                      await acceptTaskAction(task.id);
                    }}
                  >
                    <Button type="submit">Accept task</Button>
                  </form>
                ) : null}
                <Link href={ROUTES.taskPanel(task.id, "receipt")}>
                  <Button type="button" variant="secondary">
                    Receipt
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-foreground">Brief</h2>
              {task.aiBrief ? (
                <p className="mt-2 text-sm leading-relaxed text-foreground-soft">
                  {task.aiBrief.summary}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  No AI brief yet for this task.
                </p>
              )}

              {task.aiBrief?.missingInfo &&
              task.aiBrief.missingInfo.length > 0 ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-amber-800">
                    Still needed
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {task.aiBrief.missingInfo.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-900"
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
            <CardBody>
              <h2 className="text-sm font-semibold text-foreground">
                Update status
              </h2>
              <p className="mt-1 text-sm text-muted">
                Move the task when something changes.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((next) => {
                  const active = task.status === next;
                  const stageColor =
                    TASK_STAGES.find((s) => s.status === next)?.color ??
                    "#9ca3af";
                  return (
                    <form
                      key={next}
                      action={async () => {
                        await updateTaskStatusAction(task.id, next);
                      }}
                    >
                      <button
                        type="submit"
                        className={cn(
                          "inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold transition-colors",
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
          clientLabel={task.customerName}
        />
      </div>
    </div>
  );
}
