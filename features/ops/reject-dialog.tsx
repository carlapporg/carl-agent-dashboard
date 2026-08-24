"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { rejectTaskAction } from "@/features/tasks/actions/task-actions";
import { useToast } from "@/components/providers/toast-provider";

type RejectDialogProps = {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
};

export function RejectDialog({
  taskId,
  open,
  onClose,
  onDone,
}: RejectDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const trimmed = reason.trim();

  function submit() {
    if (!taskId || trimmed.length < 1) return;
    startTransition(async () => {
      try {
        await rejectTaskAction(taskId, trimmed);
        toast("Task rejected and re-queued.", "success");
        setReason("");
        onClose();
        onDone?.();
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not reject this task.",
          "error",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reject this task?"
      description="Nest will offer it to another agent. A reason is required."
    >
      <label className="block">
        <span className="text-sm font-medium text-foreground">Reason</span>
        <Textarea
          className="mt-1.5"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Already at capacity this hour"
          maxLength={500}
          required
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          disabled={!trimmed || pending}
          onClick={submit}
        >
          Reject task
        </Button>
      </div>
    </Dialog>
  );
}
