"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { advanceTaskAction } from "@/features/tasks/actions/task-actions";
import { ItineraryPanel } from "@/features/itinerary/components/itinerary-panel";
import { TaskActionLog } from "@/features/tasks/components/task-action-log";
import { TaskAiBrief } from "@/features/tasks/components/task-ai-brief";
import {
  TaskChatThread,
  type TaskChatThreadHandle,
} from "@/features/tasks/components/task-chat-thread";
import { TaskChecklist } from "@/features/tasks/components/task-checklist";
import { TaskCustomerSnippet } from "@/features/tasks/components/task-customer-snippet";
import { TaskPaymentSection } from "@/features/tasks/components/task-payment-section";
import { TaskReceipts } from "@/features/tasks/components/task-receipts";
import { TaskStatusStepper } from "@/features/tasks/components/task-status-stepper";
import { TaskSubtasks } from "@/features/tasks/components/task-subtasks";
import {
  allStepsComplete,
  canCompleteTask,
  completeGateReasons,
  hasStartedWork,
  primaryActionLabel,
  taskRequiresPayment,
} from "@/features/tasks/lib/workflow";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";
import type { Itinerary } from "@/types/itinerary";
import type { TimelineEvent } from "@/types/message";
import type {
  PaymentAuthorization,
  Receipt,
  VirtualCardSummary,
} from "@/types/payment";
import type { Task } from "@/types/task";

type TaskWorkspaceProps = {
  task: Task;
  timeline: TimelineEvent[];
  authorizations: PaymentAuthorization[];
  customer?: CustomerProfile | null;
  customerHistory?: CustomerHistoryItem[];
  childTasks?: Task[];
  parentTask?: Task | null;
  itinerary?: Itinerary | null;
  receipts?: Receipt[];
  card?: VirtualCardSummary | null;
  readOnly?: boolean;
};

type ExtraTab = "customer" | "itinerary" | "log";

function phaseLabel(task: Task): string {
  if (task.status === "completed") return "Completed";
  if (task.status === "waiting_for_payment") return "Waiting payment";
  if (task.status === "waiting_for_customer") return "Waiting customer";
  if (hasStartedWork(task)) return "In progress";
  return "Assigned";
}

export function TaskWorkspace({
  task,
  timeline,
  authorizations,
  customer = null,
  customerHistory = [],
  childTasks = [],
  parentTask = null,
  itinerary = null,
  receipts = [],
  card = null,
  readOnly = false,
}: TaskWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [extraTab, setExtraTab] = useState<ExtraTab | null>(null);
  const chatRef = useRef<TaskChatThreadHandle>(null);

  const needsPayment = taskRequiresPayment(task);
  const paymentApproved = authorizations.some(
    (a) => a.status === "approved" || a.status === "spent",
  );
  const actionLabel = readOnly
    ? null
    : primaryActionLabel(task, paymentApproved);
  const started = hasStartedWork(task);
  const stepsDone = allStepsComplete(task);
  const gateReasons = completeGateReasons(task, paymentApproved);
  const showPayment = needsPayment && started && task.status !== "completed";
  const showCompleteHint =
    !readOnly &&
    started &&
    !canCompleteTask(task, paymentApproved) &&
    task.status !== "completed";
  const showItinerary = !task.parentId && childTasks.length > 0;

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel) return;
    if (panel === "log") setExtraTab("log");
    if (panel === "payment") {
      document.getElementById("panel-payment")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (panel === "chat") {
      document.getElementById("panel-chat")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (panel === "brief") {
      document.getElementById("panel-brief")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [searchParams]);

  function runPrimary() {
    if (actionLabel === "Complete task") {
      setCompleteOpen(true);
      return;
    }
    startTransition(async () => {
      await advanceTaskAction(task.id);
      router.refresh();
    });
  }

  function confirmComplete() {
    startTransition(async () => {
      await advanceTaskAction(task.id);
      setCompleteOpen(false);
      router.refresh();
    });
  }

  function fillChat(text: string) {
    chatRef.current?.prefills(text);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      document.getElementById("panel-chat")?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href={readOnly ? ROUTES.history : ROUTES.tasks}
        className="inline-flex text-sm font-semibold text-accent hover:text-accent-hover"
      >
        ← Back to {readOnly ? "history" : "tasks"}
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start">
        {/* Work column */}
        <div className="space-y-3">
          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-surface-hover px-2.5 py-0.5 font-semibold text-muted">
                #{task.number}
              </span>
              <span className="rounded-md border border-border px-2.5 py-0.5 font-medium text-foreground-soft">
                {phaseLabel(task)}
              </span>
              {task.tier === "vip" || task.tier === "family" ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {task.tier.toUpperCase()}
                </span>
              ) : null}
              {readOnly ? (
                <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Read-only
                </span>
              ) : null}
            </div>

            <h1 className="mt-2.5 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {task.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              {task.request}
            </p>

            <div className="mt-4 border-t border-border pt-3">
              <TaskStatusStepper
                task={task}
                parent={parentTask}
                compact
              />
            </div>

            {actionLabel ? (
              <div className="mt-4">
                <Button
                  type="button"
                  loading={pending}
                  disabled={pending}
                  onClick={runPrimary}
                >
                  {actionLabel}
                </Button>
              </div>
            ) : showCompleteHint ? (
              <p className="mt-4 text-sm text-muted">
                {!stepsDone
                  ? "Finish the steps below, then you can complete the task."
                  : needsPayment && !paymentApproved
                    ? "Get payment approved below, then you can complete."
                    : null}
              </p>
            ) : null}
          </section>

          <TaskAiBrief
            summary={task.aiBrief?.summary}
            missingInfo={task.aiBrief?.missingInfo}
            onAskMissing={(item) =>
              fillChat(`Could you confirm: ${item}?`)
            }
          />

          <TaskChecklist task={task} locked={!started || readOnly} />

          {childTasks.length > 0 ? (
            <TaskSubtasks parent={task} childTasks={childTasks} />
          ) : null}

          {showPayment || (readOnly && authorizations.length > 0) ? (
            <TaskPaymentSection
              taskId={task.id}
              authorizations={authorizations}
              card={card}
              disabled={readOnly || task.status === "completed"}
            />
          ) : null}

          {(showPayment || receipts.length > 0) && !readOnly ? (
            <TaskReceipts
              taskId={task.id}
              receipts={receipts}
              authorizations={authorizations}
              disabled={task.status === "completed"}
            />
          ) : null}

          {/* Secondary details — collapsed by default */}
          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              More details
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  customer ? ("customer" as const) : null,
                  showItinerary ? ("itinerary" as const) : null,
                  "log" as const,
                ].filter(Boolean) as ExtraTab[]
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() =>
                    setExtraTab((cur) => (cur === tab ? null : tab))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    extraTab === tab
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-foreground-soft hover:border-accent/35",
                  )}
                >
                  {tab === "customer"
                    ? "Customer"
                    : tab === "itinerary"
                      ? "Itinerary"
                      : "Action log"}
                </button>
              ))}
            </div>

            {extraTab === "customer" && customer ? (
              <div className="mt-3 border-t border-border pt-3">
                <TaskCustomerSnippet
                  profile={customer}
                  history={customerHistory}
                  readOnly={readOnly}
                />
              </div>
            ) : null}
            {extraTab === "itinerary" && showItinerary ? (
              <div className="mt-3 border-t border-border pt-3">
                <ItineraryPanel
                  parent={task}
                  childTasks={childTasks}
                  itinerary={itinerary}
                />
              </div>
            ) : null}
            {extraTab === "log" ? (
              <div className="mt-3 border-t border-border pt-3" id="panel-log">
                <TaskActionLog timeline={timeline} />
              </div>
            ) : null}
          </section>
        </div>

        {/* Chat stays visible — sticky on desktop */}
        <div className="lg:sticky lg:top-4">
          <TaskChatThread
            ref={chatRef}
            taskId={task.id}
            timeline={timeline}
            quickActions={task.aiBrief?.missingInfo ?? []}
            showTemplates={!readOnly}
          />
        </div>
      </div>

      <ConfirmDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onConfirm={confirmComplete}
        title="Complete this task?"
        description={
          gateReasons.length === 0
            ? "Steps are done and payment is reconciled if required. Mark this task complete?"
            : `Still open: ${gateReasons.join("; ")}`
        }
        confirmLabel="Complete task"
        loading={pending}
      />
    </div>
  );
}
