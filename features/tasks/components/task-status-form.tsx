"use client";

import { useEffect, useState, useTransition } from "react";
import { updateTaskAgentStatusAction } from "@/features/tasks/actions/task-actions";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { isClosedTask } from "@/features/tasks/lib/workflow";
import type { Task } from "@/types/task";

const STATUS_OPTIONS = [
  {
    value: "WAITING_FOR_USER" as const,
    label: "Waiting for user",
    hint: "Pause until the client replies.",
  },
  {
    value: "COMPLETED" as const,
    label: "Completed",
    hint: "Work is done. Nest notifies the client.",
  },
  {
    value: "FAILED" as const,
    label: "Failed",
    hint: "Could not finish. Nest notifies the client.",
  },
  {
    value: "CANCELLED" as const,
    label: "Cancelled",
    hint: "Stop the task. Nest notifies the client.",
  },
];

type TaskStatusFormProps = {
  task: Task;
  disabled?: boolean;
  blockComplete?: boolean;
  onUpdated?: (
    status: "WAITING_FOR_USER" | "COMPLETED" | "FAILED" | "CANCELLED",
  ) => void;
};

export function TaskStatusForm({
  task,
  disabled,
  blockComplete = false,
  onUpdated,
}: TaskStatusFormProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<
    "WAITING_FOR_USER" | "COMPLETED" | "FAILED" | "CANCELLED"
  >("WAITING_FOR_USER");
  const [pending, startTransition] = useTransition();
  const [confirmComplete, setConfirmComplete] = useState(false);

  useEffect(() => {
    if (blockComplete && status === "COMPLETED") {
      setStatus("WAITING_FOR_USER");
    }
  }, [blockComplete, status]);

  const closed = isClosedTask(task);
  const locked = disabled || closed;

  function submit() {
    if (status === "COMPLETED") {
      if (blockComplete) {
        toast("Wait for the client to confirm before completing.", "error");
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
        toast("Status updated. The client will be notified.", "success");
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
            : "Nest updates the task and messages the client."}
      </p>

      <fieldset
        className="mt-3 space-y-2 disabled:pointer-events-none disabled:opacity-60"
        disabled={locked || pending}
      >
        {STATUS_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-accent/40 has-[:checked]:bg-accent/[0.04]"
          >
            <input
              type="radio"
              name="task-status"
              className="mt-1"
              checked={status === option.value}
              disabled={option.value === "COMPLETED" && blockComplete}
              onChange={() => setStatus(option.value)}
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {option.label}
              </span>
              <span className="text-xs text-muted">
                {option.value === "COMPLETED" && blockComplete
                  ? "Locked until the client confirms the details."
                  : option.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-3">
        <Button
          type="button"
          loading={pending}
          disabled={locked || pending}
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
