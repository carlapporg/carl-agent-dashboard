"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateTaskAgentStatusAction } from "@/features/tasks/actions/task-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
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
};

export function TaskStatusForm({ task, disabled }: TaskStatusFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<
    "WAITING_FOR_USER" | "COMPLETED" | "FAILED" | "CANCELLED"
  >("WAITING_FOR_USER");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const locked =
    disabled ||
    task.status === "completed" ||
    task.status === "cancelled" ||
    task.status === "failed" ||
    task.backendStatus === "ASSIGNED";

  function submit() {
    startTransition(async () => {
      try {
        await updateTaskAgentStatusAction(task.id, status, note.trim() || undefined);
        toast("Status updated. The client will be notified.", "success");
        router.refresh();
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
        Nest sends the client notification. Start must be used before this.
      </p>

      <fieldset className="mt-3 space-y-2" disabled={locked || pending}>
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
              onChange={() => setStatus(option.value)}
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {option.label}
              </span>
              <span className="text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-3 block">
        <span className="text-sm font-medium text-foreground">Note (optional)</span>
        <Textarea
          className="mt-1.5 min-h-20"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Shown to the client in the push body"
          maxLength={1000}
          disabled={locked || pending}
        />
      </label>

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
    </section>
  );
}
