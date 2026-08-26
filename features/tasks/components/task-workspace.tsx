"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  startTaskAction,
  rejectTaskAction,
  updateTaskAgentStatusAction,
} from "@/features/tasks/actions/task-actions";
import { OfferActions } from "@/features/dashboard/components/offer-actions";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import {
  isRejectingOrRejected,
  useOfferDecision,
} from "@/features/ops/auto-accept-offer";
import { markOfferRejected } from "@/features/ops/rejected-offers";
import { ItineraryPanel } from "@/features/itinerary/components/itinerary-panel";
import { TaskActionLog } from "@/features/tasks/components/task-action-log";
import { TaskAgentNotes } from "@/features/tasks/components/task-agent-notes";
import {
  TaskChatThread,
  type TaskChatThreadHandle,
} from "@/features/tasks/components/task-chat-thread";
import { TaskConfirmationPanel } from "@/features/tasks/components/task-confirmation-panel";
import { TaskCustomerSnippet } from "@/features/tasks/components/task-customer-snippet";
import { TaskFacts } from "@/features/tasks/components/task-facts";
import { taskDisplayCode, taskDisplayTitle } from "@/lib/tasks/details";
import { TaskStatusStepper } from "@/features/tasks/components/task-status-stepper";
import { TaskStatusForm } from "@/features/tasks/components/task-status-form";
import { TaskSubtasks } from "@/features/tasks/components/task-subtasks";
import {
  canCompleteTask,
  canMessageClient,
  canStartTask,
  canUpdateAgentStatus,
  closedTaskMessage,
  completeGateReasons,
  hasStartedWork,
  isClosedTask,
  isFailedOrCancelled,
  messageClientHint,
  primaryActionLabel,
} from "@/features/tasks/lib/workflow";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useOps } from "@/features/ops/ops-provider";
import { uiStatusFromAgent } from "@/lib/api/map-task";
import { liveStatusPatch, pinWhileRejecting } from "@/lib/tasks/merge-live-task";
import type { AgentTaskStatus } from "@/types/agent";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { offerWindowEnd } from "@/types/agent";
import type { TaskConfirmation } from "@/types/confirmation";
import { isConfirmationConfirmed } from "@/types/confirmation";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";
import type { Itinerary } from "@/types/itinerary";
import type { TimelineEvent } from "@/types/message";
import type { Task } from "@/types/task";

type TaskWorkspaceProps = {
  task: Task;
  timeline: TimelineEvent[];
  confirmation?: TaskConfirmation | null;
  customer?: CustomerProfile | null;
  customerHistory?: CustomerHistoryItem[];
  childTasks?: Task[];
  parentTask?: Task | null;
  itinerary?: Itinerary | null;
  readOnly?: boolean;
};

type ExtraTab = "customer" | "itinerary" | "log";

function phaseLabel(task: Task, rejecting = false): string {
  if (rejecting) return "Rejecting";
  const status = task.backendStatus;
  if (status === "OFFERED") return "Offered";
  if (status === "QUEUED") return "Offered";
  if (status === "ASSIGNED") return "Assigned";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "WAITING_FOR_USER") return "Waiting for user";
  if (status === "WAITING_FOR_AGENT") return "Waiting for agent";
  if (status === "COMPLETED") return "Completed";
  if (status === "FAILED") return "Failed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "REJECTED") return "Rejected";
  if (task.status === "completed") return "Completed";
  if (task.status === "waiting_for_payment") return "Waiting payment";
  if (task.status === "waiting_for_customer") return "Waiting customer";
  if (hasStartedWork(task)) return "In progress";
  return "Assigned";
}

function withBackendStatus(task: Task, backendStatus: AgentTaskStatus): Task {
  return {
    ...task,
    backendStatus,
    status: uiStatusFromAgent(backendStatus),
    updatedAt: new Date().toISOString(),
    completedAt:
      backendStatus === "COMPLETED"
        ? new Date().toISOString()
        : task.completedAt,
  };
}

export function TaskWorkspace({
  task: taskProp,
  timeline,
  confirmation: confirmationProp = null,
  customer = null,
  customerHistory = [],
  childTasks = [],
  parentTask = null,
  itinerary = null,
  readOnly = false,
}: TaskWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const ops = useOps();
  const [pending, startTransition] = useTransition();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [extraTab, setExtraTab] = useState<ExtraTab | null>(null);
  const chatRef = useRef<TaskChatThreadHandle>(null);
  const [taskState, setTask] = useState(taskProp);
  const [confirmation, setConfirmation] = useState(confirmationProp);
  const decision = useOfferDecision(taskProp.id);
  const rejecting =
    decision.flight === "reject" || decision.settled === "rejected";

  useEffect(() => {
    if (isRejectingOrRejected(taskProp.id)) {
      setTask(pinWhileRejecting(taskProp));
      return;
    }
    setTask(taskProp);
  }, [taskProp, rejecting]);

  useEffect(() => {
    const live =
      ops?.liveConfirmation?.taskId === taskState.id ? ops.liveConfirmation : null;
    if (!live) {
      setConfirmation(confirmationProp);
      return;
    }
    if (!confirmationProp) {
      setConfirmation(live);
      return;
    }
    const liveAt = new Date(live.updatedAt || live.decidedAt || 0).getTime();
    const propAt = new Date(
      confirmationProp.updatedAt || confirmationProp.decidedAt || 0,
    ).getTime();
    setConfirmation(liveAt >= propAt ? live : confirmationProp);
  }, [confirmationProp, ops?.liveConfirmation, taskState.id]);

  const task = rejecting ? pinWhileRejecting(taskState) : taskState;
  const closed = isClosedTask(task);
  const lockedReadOnly = readOnly || closed;
  const clientConfirmed = isConfirmationConfirmed(confirmation);
  const actionLabel = lockedReadOnly
    ? null
    : primaryActionLabel(task, true, confirmation);
  const started = hasStartedWork(task);
  const gateReasons = completeGateReasons(task, true, confirmation);
  const bookingLocked = !lockedReadOnly && started && !clientConfirmed;
  const showCompleteHint =
    !lockedReadOnly &&
    started &&
    !canCompleteTask(task, true, confirmation);
  const showItinerary = !task.parentId && childTasks.length > 0;

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel) return;
    if (panel === "log") setExtraTab("log");
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
    if (actionLabel === "Complete task" || actionLabel === "Complete booking") {
      setCompleteOpen(true);
      return;
    }
    if (!canStartTask(task)) {
      toast(closedTaskMessage(task), "error");
      return;
    }
    startTransition(async () => {
      const snapshot = task;
      setTask(withBackendStatus(task, "IN_PROGRESS"));
      ops?.patchLiveTask(task.id, liveStatusPatch("IN_PROGRESS", "in_progress"));
      const result = await startTaskAction(task.id);
      if (!result.ok) {
        setTask(snapshot);
        toast(result.message, "error");
      }
    });
  }

  function confirmComplete() {
    if (isClosedTask(task)) return;
    if (!isConfirmationConfirmed(confirmation)) {
      toast("Wait for the client to confirm before completing.", "error");
      setCompleteOpen(false);
      return;
    }
    startTransition(async () => {
      const snapshot = task;
      setTask(withBackendStatus(task, "COMPLETED"));
      ops?.patchLiveTask(task.id, liveStatusPatch("COMPLETED", "completed"));
      setCompleteOpen(false);
      const result = await updateTaskAgentStatusAction(task.id, "COMPLETED");
      if (!result.ok) {
        setTask(snapshot);
        toast(result.message, "error");
      }
    });
  }

  function rejectOffer() {
    const reason = window.prompt("Why are you rejecting this task?");
    if (!reason?.trim()) return;
    startTransition(async () => {
      const result = await rejectTaskAction(task.id, reason.trim());
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      markOfferRejected(task.id);
      ops?.dropLiveTask(task.id);
      ops?.dismissOffer();
      toast("Task rejected. It will be offered to another agent.", "success");
      router.replace(ROUTES.tasks);
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
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-7.5rem)] lg:min-h-0 lg:overflow-hidden">
      <Link
        href={lockedReadOnly ? ROUTES.history : ROUTES.tasks}
        className="inline-flex shrink-0 text-sm font-semibold text-accent hover:text-accent-hover"
      >
        ← Back to {lockedReadOnly ? "history" : "tasks"}
      </Link>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-stretch">
        {/* Work column */}
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-surface-hover px-2.5 py-0.5 font-semibold text-muted">
                {taskDisplayCode(task)}
              </span>
              <span className="rounded-md border border-border px-2.5 py-0.5 font-medium text-foreground-soft">
                {phaseLabel(task, rejecting)}
              </span>
              {task.tier === "vip" || task.tier === "family" ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {task.tier.toUpperCase()}
                </span>
              ) : null}
              {lockedReadOnly ? (
                <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Read-only
                </span>
              ) : null}
            </div>

            <h1 className="mt-2.5 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {taskDisplayTitle(task)}
            </h1>

            <div className="mt-4 border-t border-border pt-3">
              <TaskStatusStepper
                task={task}
                parent={parentTask}
                compact
              />
            </div>

            {(task.backendStatus === "OFFERED" ||
              task.backendStatus === "ASSIGNED") &&
            !lockedReadOnly ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {task.backendStatus === "OFFERED" ? (
                  <OfferCountdown
                    expiresAt={offerWindowEnd(task)}
                    taskId={task.id}
                    autoAccept
                    size="lg"
                    onExpire={() => {
                      if (decision.flight === "reject" || decision.settled === "rejected") {
                        return;
                      }
                      router.refresh();
                    }}
                  />
                ) : null}
                <OfferActions task={task} />
              </div>
            ) : closed ? (
              <p className="mt-4 text-sm text-muted">{closedTaskMessage(task)}</p>
            ) : actionLabel ? (
              <div className="mt-4 flex flex-wrap gap-2">
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
                {bookingLocked
                  ? confirmation?.status === "PENDING"
                    ? "Waiting for the client to confirm. You cannot book yet."
                    : confirmation?.status === "DECLINED"
                      ? "The client declined. Send a new confirmation below."
                      : "Send the client confirmation below before you book."
                  : null}
              </p>
            ) : null}
          </section>

          <TaskFacts task={task} />

          <TaskConfirmationPanel
            taskId={task.id}
            taskStatus={task.backendStatus}
            confirmation={confirmation}
            disabled={lockedReadOnly}
            onSent={(next) => {
              setConfirmation(next);
              ops?.setLiveConfirmation(next);
              setTask(withBackendStatus(task, "WAITING_FOR_USER"));
              ops?.patchLiveTask(
                task.id,
                liveStatusPatch("WAITING_FOR_USER", "waiting_for_customer"),
                task,
              );
              router.refresh();
            }}
          />

          <TaskStatusForm
            task={task}
            disabled={!canUpdateAgentStatus(task)}
            blockComplete={!clientConfirmed}
            onUpdated={(status) => {
              setTask(withBackendStatus(task, status));
              ops?.patchLiveTask(task.id, {
                backendStatus: status,
                status: uiStatusFromAgent(status),
                updatedAt: new Date().toISOString(),
              });
            }}
          />

          <TaskAgentNotes taskId={task.id} disabled={lockedReadOnly} />

          {childTasks.length > 0 ? (
            <TaskSubtasks parent={task} childTasks={childTasks} />
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

        <div className="flex h-[calc(100dvh-10rem)] min-h-0 flex-col overflow-hidden lg:h-full">
          <TaskChatThread
            ref={chatRef}
            className="h-full min-h-0"
            taskId={task.id}
            timeline={timeline}
            quickActions={task.aiBrief?.missingInfo ?? []}
            showTemplates={canMessageClient(task) && !isFailedOrCancelled(task)}
            title="Conversation"
            subtitle={`With ${task.customerName}`}
            clientLabel={task.customerName}
            disabled={!canMessageClient(task)}
            disabledHint={messageClientHint(task)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onConfirm={confirmComplete}
        title="Complete this booking?"
        description={
          gateReasons.length === 0
            ? "The client confirmed. Mark this booking complete?"
            : `Still open: ${gateReasons.join("; ")}`
        }
        confirmLabel="Complete booking"
        loading={pending}
      />
    </div>
  );
}
