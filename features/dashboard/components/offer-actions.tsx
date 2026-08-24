"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startTaskAction } from "@/features/tasks/actions/task-actions";
import { RejectDialog } from "@/features/ops/reject-dialog";
import { useOps } from "@/features/ops/ops-provider";
import { useToast } from "@/components/providers/toast-provider";
import { isRejectWindowOpen } from "@/types/agent";
import type { Task } from "@/types/task";

type OfferActionsProps = {
  task: Task;
};

export function OfferActions({ task }: OfferActionsProps) {
  const router = useRouter();
  const ops = useOps();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const assigned = task.backendStatus === "ASSIGNED";
  const canReject = assigned && isRejectWindowOpen(task.updatedAt);

  if (task.backendStatus !== "ASSIGNED" && task.status !== "assigned") {
    return null;
  }

  function accept() {
    startTransition(async () => {
      try {
        await startTaskAction(task.id);
        toast("Task started.", "success");
        ops?.dismissOffer();
        ops?.refresh();
        router.refresh();
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not start this task.",
          "error",
        );
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={pending} disabled={pending} onClick={accept}>
          Start
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !canReject}
          onClick={() => setRejectOpen(true)}
        >
          {canReject ? "Reject" : "Locked"}
        </Button>
      </div>
      <RejectDialog
        taskId={rejectOpen ? task.id : null}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onDone={() => {
          ops?.dismissOffer();
          ops?.refresh();
          router.refresh();
        }}
      />
    </>
  );
}
