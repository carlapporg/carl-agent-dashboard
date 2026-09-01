"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  getTaskConfirmationAction,
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
import { PaymentProofPanel } from "@/features/tasks/components/payment-proof-panel";
import { TaskCustomerSnippet } from "@/features/tasks/components/task-customer-snippet";
import { TaskFacts } from "@/features/tasks/components/task-facts";
import { PageChromeSetter } from "@/features/shell/page-chrome";
import { taskDisplayCode, taskDisplayTitle } from "@/lib/tasks/details";
import {
  isTaskConfirmationKnown,
  markTaskConfirmationKnown,
  markTaskReceiptKnown,
} from "@/lib/tasks/confirmation-presence";
import { TaskStatusStepper } from "@/features/tasks/components/task-status-stepper";
import { formatStatus } from "@/features/tasks/components/status-badge";
import { TaskStatusForm } from "@/features/tasks/components/task-status-form";
import { TaskSubtasks } from "@/features/tasks/components/task-subtasks";
import {
  canCompleteTask,
  canMessageClient,
  canStartTask,
  canUpdateAgentStatus,
  closedTaskMessage,
  completeGateReasons,
  displayedTaskStatus,
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
import {
  isReceiptAccepted,
  isReceiptPending,
  isReceiptRejected,
  type TaskReceipt,
} from "@/types/receipt";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";
import type { Itinerary } from "@/types/itinerary";
import type { TimelineEvent } from "@/types/message";
import type { Task } from "@/types/task";

type TaskWorkspaceProps = {
  task: Task;
  timeline: TimelineEvent[];
  confirmation?: TaskConfirmation | null;
  receipt?: TaskReceipt | null;
  customer?: CustomerProfile | null;
  customerHistory?: CustomerHistoryItem[];
  childTasks?: Task[];
  parentTask?: Task | null;
  itinerary?: Itinerary | null;
  readOnly?: boolean;
};

type ExtraTab = "customer" | "itinerary" | "log";

function phaseLabel(
  task: Task,
  confirmation: TaskConfirmation | null,
  receipt: TaskReceipt | null,
  rejecting = false,
): string {
  if (rejecting) return "Rejecting";
  if (task.backendStatus === "REJECTED") return "Rejected";
  return formatStatus(displayedTaskStatus(task, confirmation, receipt));
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
  receipt: receiptProp = null,
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
  const [receipt, setReceipt] = useState(receiptProp);
  const declinedResumeKey = useRef<string | null>(null);
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
    if (confirmationProp) markTaskConfirmationKnown(taskProp.id);
    if (receiptProp) markTaskReceiptKnown(taskProp.id);
  }, [confirmationProp, receiptProp, taskProp.id]);

  /**
   * After customer declines, Nest returns the task to IN_PROGRESS.
   * SSR skips confirmation GET on IN_PROGRESS (avoids 404). Reload the
   * known confirmation only when we already created one this session.
   */
  useEffect(() => {
    if (confirmationProp) return;
    if (
      taskProp.backendStatus !== "IN_PROGRESS" &&
      taskProp.backendStatus !== "WAITING_FOR_AGENT"
    ) {
      return;
    }
    if (!isTaskConfirmationKnown(taskProp.id)) return;
    let cancelled = false;
    void getTaskConfirmationAction(taskProp.id).then((result) => {
      if (cancelled || !result.ok || !result.confirmation) return;
      markTaskConfirmationKnown(taskProp.id);
      setConfirmation(result.confirmation);
    });
    return () => {
      cancelled = true;
    };
  }, [confirmationProp, taskProp.backendStatus, taskProp.id]);

  useEffect(() => {
    const live =
      ops?.liveConfirmation?.taskId === taskState.id ? ops.liveConfirmation : null;
    if (live) {
      markTaskConfirmationKnown(taskState.id);
      if (!confirmationProp) {
        setConfirmation(live);
        return;
      }
      const liveAt = new Date(live.updatedAt || live.decidedAt || 0).getTime();
      const propAt = new Date(
        confirmationProp.updatedAt || confirmationProp.decidedAt || 0,
      ).getTime();
      setConfirmation(liveAt >= propAt ? live : confirmationProp);
      return;
    }
    if (confirmationProp) {
      setConfirmation(confirmationProp);
    }
  }, [confirmationProp, ops?.liveConfirmation, taskState.id]);

  useEffect(() => {
    const live =
      ops?.liveReceipt?.taskId === taskState.id ? ops.liveReceipt : null;
    if (live) {
      markTaskReceiptKnown(taskState.id);
      if (!receiptProp) {
        setReceipt(live);
        return;
      }
      const liveAt = new Date(live.updatedAt || live.decidedAt || 0).getTime();
      const propAt = new Date(
        receiptProp.updatedAt || receiptProp.decidedAt || 0,
      ).getTime();
      setReceipt(liveAt >= propAt ? live : receiptProp);
      return;
    }
    if (receiptProp) {
      setReceipt(receiptProp);
    }
  }, [receiptProp, ops?.liveReceipt, taskState.id]);

  useEffect(() => {
    if (confirmation?.status !== "DECLINED") {
      if (confirmation?.status === "PENDING") declinedResumeKey.current = null;
      return;
    }
    const key = `${taskState.id}:${confirmation.id}`;
    if (declinedResumeKey.current === key) return;
    declinedResumeKey.current = key;
    markTaskConfirmationKnown(taskState.id);
    setTask((current) => withBackendStatus(current, "IN_PROGRESS"));
    ops?.patchLiveTask(
      taskState.id,
      liveStatusPatch("IN_PROGRESS", "in_progress"),
      taskState,
    );
    // Nest should already move to IN_PROGRESS on decline; keep PATCH as safety.
    if (taskState.backendStatus !== "IN_PROGRESS") {
      void updateTaskAgentStatusAction(taskState.id, "IN_PROGRESS");
    }
  }, [confirmation, ops, taskState.backendStatus, taskState.id]);

  const task = rejecting ? pinWhileRejecting(taskState) : taskState;
  const viewTask = {
    ...task,
    status: displayedTaskStatus(task, confirmation, receipt),
  };
  const closed = isClosedTask(task);
  const lockedReadOnly = readOnly || closed;
  const detailsConfirmed = isConfirmationConfirmed(confirmation);
  const receiptAccepted = isReceiptAccepted(receipt);
  const bothConfirmed = detailsConfirmed && receiptAccepted;
  const actionLabel = lockedReadOnly
    ? null
    : primaryActionLabel(task, confirmation, receipt);
  const started = hasStartedWork(task);
  const gateReasons = completeGateReasons(task, confirmation, receipt);
  const bookingLocked = !lockedReadOnly && started && !bothConfirmed;
  const showCompleteHint =
    !lockedReadOnly &&
    started &&
    !canCompleteTask(task, confirmation, receipt);
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
      return;
    }
    if (panel === "receipt") {
      document.getElementById("panel-receipt")?.scrollIntoView({
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
      ops?.patchLiveTask(
        task.id,
        liveStatusPatch("IN_PROGRESS", "in_progress"),
        task,
      );
      const result = await startTaskAction(task.id);
      if (!result.ok) {
        setTask(snapshot);
        toast(result.message, "error");
      }
    });
  }

  function confirmComplete() {
    if (isClosedTask(task)) return;
    if (!isConfirmationConfirmed(confirmation) || !isReceiptAccepted(receipt)) {
      toast("Wait for the user to accept the receipt before completing.", "error");
      setCompleteOpen(false);
      return;
    }
    startTransition(async () => {
      const snapshot = task;
      setTask(withBackendStatus(task, "COMPLETED"));
      ops?.patchLiveTask(
        task.id,
        liveStatusPatch("COMPLETED", "completed"),
        task,
      );
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
    <>
      <PageChromeSetter
        title={taskDisplayTitle(task)}
        subtitle={`${taskDisplayCode(task)} · ${task.customerName}`}
      />
      <div className="flex flex-col gap-3 lg:h-[calc(100dvh-7.5rem)] lg:min-h-0 lg:overflow-hidden">
      <Link
        href={lockedReadOnly ? ROUTES.history : ROUTES.tasks}
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover"
      >
        ← Back to {lockedReadOnly ? "history" : "tasks"}
      </Link>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-stretch">
        {/* Work column */}
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-[var(--radius-sm)] bg-surface-hover px-2.5 py-0.5 font-semibold text-muted">
                {taskDisplayCode(task)}
              </span>
              <span className="rounded-[var(--radius-sm)] border border-border px-2.5 py-0.5 font-medium text-foreground-soft">
                {phaseLabel(task, confirmation, receipt, rejecting)}
              </span>
              {task.tier === "vip" || task.tier === "family" ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {task.tier.toUpperCase()}
                </span>
              ) : null}
              {lockedReadOnly ? (
                <span className="rounded-[var(--radius-sm)] bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
                  Read-only
                </span>
              ) : null}
            </div>

            <h1 className="mt-2.5 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {taskDisplayTitle(task)}
            </h1>

            <div className="mt-4 border-t border-border pt-3">
              <TaskStatusStepper
                task={viewTask}
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
                    ? "Waiting for the client to confirm the task details."
                    : confirmation?.status === "DECLINED"
                      ? "The client declined the details. Send a new confirmation below."
                      : !detailsConfirmed
                        ? "Send the task details confirmation before you book."
                        : isReceiptPending(receipt)
                          ? "Waiting for the user to review the receipt."
                          : isReceiptRejected(receipt)
                            ? "The user rejected the receipt. Upload a new one below."
                            : "Upload a receipt and wait for the user to accept it before you complete."
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
              markTaskConfirmationKnown(task.id);
              setConfirmation(next);
              ops?.setLiveConfirmation(next);
              setTask({
                ...withBackendStatus(task, "WAITING_FOR_USER"),
                status: "waiting_for_customer",
              });
              ops?.patchLiveTask(
                task.id,
                liveStatusPatch("WAITING_FOR_USER", "waiting_for_customer"),
                task,
              );
              // Waiting for Customer is set only when Task Details Confirmation is sent.
              if (task.backendStatus !== "WAITING_FOR_USER") {
                void updateTaskAgentStatusAction(task.id, "WAITING_FOR_USER");
              }
              router.refresh();
            }}
          />

          {detailsConfirmed ? (
            <PaymentProofPanel
              taskId={task.id}
              taskStatus={task.backendStatus}
              receipt={receipt}
              disabled={lockedReadOnly}
              onChanged={(next) => {
                markTaskReceiptKnown(task.id);
                setReceipt(next);
                ops?.setLiveReceipt(next);
                if (next.status === "PENDING") {
                  setTask({
                    ...withBackendStatus(task, "WAITING_FOR_USER"),
                    status: "waiting_for_payment",
                  });
                  ops?.patchLiveTask(
                    task.id,
                    liveStatusPatch("WAITING_FOR_USER", "waiting_for_payment"),
                    task,
                  );
                }
                router.refresh();
              }}
            />
          ) : null}

          <TaskStatusForm
            task={task}
            displayStatus={viewTask.status}
            disabled={!canUpdateAgentStatus(task)}
            blockComplete={!bothConfirmed}
            onUpdated={(status) => {
              setTask(withBackendStatus(task, status));
              ops?.patchLiveTask(task.id, {
                backendStatus: status,
                status: uiStatusFromAgent(status),
                updatedAt: new Date().toISOString(),
              }, task);
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
            ? "The user accepted the receipt. Mark this booking complete?"
            : `Still open: ${gateReasons.join("; ")}`
        }
        confirmLabel="Complete booking"
        loading={pending}
      />
    </div>
    </>
  );
}
