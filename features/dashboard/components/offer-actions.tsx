"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptTaskAction,
  startTaskAction,
} from "@/features/tasks/actions/task-actions";
import { markOfferAccepted } from "@/features/ops/auto-accept-offer";
import { RejectDialog } from "@/features/ops/reject-dialog";
import { useOps } from "@/features/ops/ops-provider";
import { useToast } from "@/components/providers/toast-provider";
import { liveStatusPatch } from "@/lib/tasks/merge-live-task";
import {
  canRejectOffer,
  isAssignedPendingStart,
  isOfferedTask,
} from "@/types/agent";
import { isClosedTask } from "@/features/tasks/lib/workflow";
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
  const offered = isOfferedTask(task) && !isClosedTask(task);
  const assigned = isAssignedPendingStart(task) && !isClosedTask(task);
  const canReject = canRejectOffer(task);

  if (!offered && !assigned) {
    return null;
  }

  function done(patch?: Partial<Task>) {
    if (patch) ops?.patchLiveTask(task.id, patch, task);
    ops?.dismissOffer();
    ops?.refresh();
    router.refresh();
  }

  function accept() {
    startTransition(async () => {
      try {
        const result = await acceptTaskAction(task.id);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        markOfferAccepted(task.id);
        toast("Task accepted.", "success");
        done(liveStatusPatch("ASSIGNED", "assigned"));
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not accept this task.",
          "error",
        );
      }
    });
  }

  function start() {
    startTransition(async () => {
      try {
        const result = await startTaskAction(task.id);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        toast("Task started.", "success");
        done(liveStatusPatch("IN_PROGRESS", "in_progress"));
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
        {offered ? (
          <Button type="button" loading={pending} disabled={pending} onClick={accept}>
            Accept
          </Button>
        ) : (
          <Button type="button" loading={pending} disabled={pending} onClick={start}>
            Start
          </Button>
        )}
        {canReject ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
        ) : null}
      </div>
      <RejectDialog
        taskId={rejectOpen ? task.id : null}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onDone={() => done(liveStatusPatch("REJECTED", "cancelled"))}
      />
    </>
  );
}
