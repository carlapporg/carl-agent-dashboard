"use client";

import { useEffect, useState, useTransition } from "react";
import { updateTaskAgentStatusAction } from "@/features/tasks/actions/task-actions";
import { formatStatus } from "@/features/tasks/components/status-badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { isClosedTask } from "@/features/tasks/lib/workflow";
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
    hint: "Set automatically when you send the final confirmation.",
    selectable: false,
  },
  {
    value: "COMPLETED" as const,
    label: "Completed",
    hint: "Work is done. Nest notifies the client.",
    selectable: true,
  },
  {
    value: "FAILED" as const,
    label: "Failed",
    hint: "Could not finish. Nest notifies the client.",
    selectable: true,
  },
];

type AgentStatusChoice =
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "COMPLETED"
  | "FAILED";

type TaskStatusFormProps = {
  task: Task;
  displayStatus?: TaskStatus;
  disabled?: boolean;
  blockComplete?: boolean;
  onUpdated?: (status: AgentStatusChoice) => void;
};

function choiceFromDisplay(status: TaskStatus): AgentStatusChoice | null {
  if (status === "completed") return "COMPLETED";
  if (status === "failed" || status === "cancelled") return "FAILED";
  if (status === "waiting_for_customer") return "WAITING_FOR_USER";
  if (status === "in_progress") return "IN_PROGRESS";
  return null;
}

export function TaskStatusForm({
  task,
  displayStatus,
  disabled,
  blockComplete = false,
  onUpdated,
}: TaskStatusFormProps) {
  const { toast } = useToast();
  const shown = displayStatus ?? task.status;
  const current = choiceFromDisplay(shown);
  const [status, setStatus] = useState<AgentStatusChoice>(
    current ?? "IN_PROGRESS",
  );
  const [pending, startTransition] = useTransition();
  const [confirmComplete, setConfirmComplete] = useState(false);

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
  const canSubmit = status !== "WAITING_FOR_USER" && !unchanged;

  function submit() {
    if (!canSubmit) return;
    if (status === "COMPLETED") {
      if (blockComplete) {
        toast("Wait for both confirmations before completing.", "error");
        return;
      }
      setConfirmComplete(true);
      return;
    }
    apply();
  }

  function apply() {
    startTransition(async () => {
      try {
        const result = await updateTaskAgentStatusAction(task.id, status);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        onUpdated?.(status);
        toast("Status updated.", "success");
        setConfirmComplete(false);
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not update status.",
          "error",
        );
      }
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Update status</h2>
      <p className="mt-1 text-sm text-muted">
        {closed
          ? "This task is closed. Status cannot be changed."
          : locked
            ? "Start the task before you can update status."
            : `Current status: ${formatStatus(shown)}. Waiting for Customer is set only when you send the final confirmation.`}
      </p>

      <fieldset
        className="mt-3 space-y-2 disabled:pointer-events-none disabled:opacity-60"
        disabled={locked || pending}
      >
        {STATUS_OPTIONS.map((option) => {
          const isCurrent = current === option.value;
          const optionLocked =
            !option.selectable ||
            (option.value === "COMPLETED" && blockComplete) ||
            (option.value === "IN_PROGRESS" && current === "WAITING_FOR_USER");
          return (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-accent/40 has-[:checked]:bg-accent/[0.04]"
            >
              <input
                type="radio"
                name="task-status"
                className="mt-1"
                checked={status === option.value}
                disabled={optionLocked}
                onChange={() => {
                  if (!option.selectable) return;
                  setStatus(option.value);
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  {isCurrent ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      Current
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted">
                  {option.value === "COMPLETED" && blockComplete
                    ? "Locked until the user accepts the receipt."
                    : option.value === "IN_PROGRESS" && current === "WAITING_FOR_USER"
                      ? "Goes back to In Progress if the customer rejects."
                      : option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-3">
        <Button
          type="button"
          loading={pending}
          disabled={locked || pending || !canSubmit}
          onClick={submit}
        >
          Update status
        </Button>
      </div>

      <ConfirmDialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={apply}
        title="Mark this task completed?"
        description="Nest will notify the client."
        confirmLabel="Complete task"
        loading={pending}
      />
    </section>
  );
}
