"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { updateTaskAgentStatusAction } from "@/features/tasks/actions/task-actions";
import { CompleteTaskReceiptDialog } from "@/features/tasks/components/complete-task-receipt-dialog";
import { formatStatus } from "@/features/tasks/components/status-badge";
import { Button } from "@/components/ui/button";
import { ChevronIcon } from "@/components/ui/chevron-icon";
import { useToast } from "@/components/providers/toast-provider";
import { isClosedTask } from "@/features/tasks/lib/workflow";
import type { TaskReceipt } from "@/types/receipt";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_OPTIONS = [
  {
    value: "IN_PROGRESS" as const,
    label: "In Progress",
    hint: "You are working on this task. Chat does not change this.",
    selectable: true,
  },
  {
    value: "WAITING_FOR_USER" as const,
    label: "Waiting for Customer",
    hint: "Set automatically when you send Task Details Confirmation. Chat does not set this.",
    selectable: false,
  },
  {
    value: "WAITING_FOR_PAYMENT" as const,
    label: "Waiting for Payment",
    hint: "Shown after Task Details are approved, until you complete with a document.",
    selectable: false,
  },
  {
    value: "COMPLETED" as const,
    label: "Completed",
    hint: "Available after the client confirms task details. You upload the receipt when completing.",
    selectable: true,
  },
  {
    value: "FAILED" as const,
    label: "Failed",
    hint: "Use only when the task could not be finished.",
    selectable: true,
  },
];

type AgentStatusChoice =
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_PAYMENT"
  | "COMPLETED"
  | "FAILED";

type TaskStatusFormProps = {
  task: Task;
  displayStatus?: TaskStatus;
  disabled?: boolean;
  /** True when Complete must wait (e.g. task details not confirmed yet). */
  blockComplete?: boolean;
  receipt?: TaskReceipt | null;
  onReceiptChanged?: (receipt: TaskReceipt) => void;
  onUpdated?: (status: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "WAITING_FOR_USER") => void;
};

function choiceFromDisplay(status: TaskStatus): AgentStatusChoice | null {
  if (status === "completed") return "COMPLETED";
  if (status === "failed" || status === "cancelled") return "FAILED";
  if (status === "waiting_for_customer") return "WAITING_FOR_USER";
  if (status === "waiting_for_payment") return "WAITING_FOR_PAYMENT";
  if (status === "in_progress") return "IN_PROGRESS";
  return null;
}

function optionLocked(
  value: AgentStatusChoice,
  selectable: boolean,
  current: AgentStatusChoice | null,
  blockComplete: boolean,
): boolean {
  if (!selectable) return true;
  if (value === "COMPLETED" && blockComplete) return true;
  if (
    value === "IN_PROGRESS" &&
    (current === "WAITING_FOR_USER" || current === "WAITING_FOR_PAYMENT")
  ) {
    return true;
  }
  return false;
}

function optionHint(
  value: AgentStatusChoice,
  current: AgentStatusChoice | null,
  blockComplete: boolean,
  fallback: string,
): string {
  if (value === "COMPLETED" && blockComplete) {
    return "Locked until the client confirms the task details.";
  }
  if (value === "IN_PROGRESS" && current === "WAITING_FOR_USER") {
    return "Goes back to In Progress if the customer rejects Task Details.";
  }
  if (value === "IN_PROGRESS" && current === "WAITING_FOR_PAYMENT") {
    return "Available again after you upload a document at Complete.";
  }
  return fallback;
}

export function TaskStatusForm({
  task,
  displayStatus,
  disabled,
  blockComplete = false,
  receipt = null,
  onReceiptChanged,
  onUpdated,
}: TaskStatusFormProps) {
  const { toast } = useToast();
  const shown = displayStatus ?? task.status;
  const current = choiceFromDisplay(shown);
  const [status, setStatus] = useState<AgentStatusChoice>(
    current ?? "IN_PROGRESS",
  );
  const [pending, startTransition] = useTransition();
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => {
    if (current) setStatus(current);
  }, [current, task.id]);

  useEffect(() => {
    if (blockComplete && status === "COMPLETED" && current && current !== "COMPLETED") {
      setStatus(current);
    }
  }, [blockComplete, status, current]);

  const closed = isClosedTask(task);
  const locked = disabled || closed;
  const unchanged = current === status;
  const canSubmit =
    status !== "WAITING_FOR_USER" &&
    status !== "WAITING_FOR_PAYMENT" &&
    !unchanged;

  const selectedOption = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === status),
    [status],
  );

  function submit() {
    if (!canSubmit) return;
    if (status === "COMPLETED") {
      if (blockComplete) {
        toast("Wait for the client to confirm task details first.", "error");
        return;
      }
      setCompleteOpen(true);
      return;
    }
    applyNonComplete();
  }

  function applyNonComplete() {
    if (
      status === "WAITING_FOR_USER" ||
      status === "WAITING_FOR_PAYMENT" ||
      status === "COMPLETED"
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateTaskAgentStatusAction(task.id, status);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        onUpdated?.(status);
        toast("Status updated.", "success");
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not update status.",
          "error",
        );
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-foreground">
          Status Update
        </h2>
        <span className="inline-flex h-[31px] items-center rounded-[40px] bg-accent px-4 text-[12px] font-medium text-accent-foreground">
          {formatStatus(shown)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-snug text-muted">
        {closed
          ? "This task is closed. Status cannot be changed."
          : locked
            ? "Start the task before you can update status."
            : `Current status: ${formatStatus(shown)}. Waiting for Customer is set only when you send Task Details Confirmation — not by chat.`}
      </p>

      <div className="mt-5">
        <label
          htmlFor="task-status-select"
          className="mb-2 block text-[16px] font-medium tracking-[-0.04em] text-muted"
        >
          Status
        </label>
        <div className="relative">
          <select
            id="task-status-select"
            value={status}
            disabled={locked || pending}
            onChange={(event) => {
              const next = event.target.value as AgentStatusChoice;
              const option = STATUS_OPTIONS.find((item) => item.value === next);
              if (!option) return;
              if (
                optionLocked(
                  option.value,
                  option.selectable,
                  current,
                  blockComplete,
                )
              ) {
                return;
              }
              setStatus(next);
            }}
            className="h-[45px] w-full appearance-none rounded-[5px] border border-border bg-surface px-[15px] pr-10 text-[14px] font-normal tracking-[-0.05em] text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((option) => {
              const lockedOption = optionLocked(
                option.value,
                option.selectable,
                current,
                blockComplete,
              );
              // Keep the current auto-status selectable in the list so the
              // control can show it; agent cannot switch *to* locked values.
              const disableOption =
                lockedOption && option.value !== status;
              return (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={disableOption}
                >
                  {option.label}
                  {current === option.value ? " (Current)" : ""}
                  {lockedOption && option.value !== status ? " — auto" : ""}
                </option>
              );
            })}
          </select>
          <ChevronIcon
            className="pointer-events-none absolute top-1/2 right-3 size-[15px] -translate-y-1/2 text-muted"
          />
        </div>
        {selectedOption ? (
          <p className="mt-2 text-xs text-muted">
            {optionHint(
              selectedOption.value,
              current,
              blockComplete,
              selectedOption.hint,
            )}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <Button
          type="button"
          loading={pending}
          disabled={locked || pending || !canSubmit}
          onClick={submit}
          className="h-[43px] rounded-[35px] px-6"
        >
          Update status
        </Button>
      </div>

      <CompleteTaskReceiptDialog
        open={completeOpen}
        taskId={task.id}
        receipt={receipt}
        onClose={() => setCompleteOpen(false)}
        onCompleted={(nextReceipt) => {
          if (nextReceipt) onReceiptChanged?.(nextReceipt);
          setCompleteOpen(false);
          onUpdated?.("COMPLETED");
        }}
      />
    </section>
  );
}
