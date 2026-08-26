"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptTaskAction,
  startTaskAction,
} from "@/features/tasks/actions/task-actions";
import {
  beginAcceptOffer,
  isRejectingOrRejected,
  markOfferAccepted,
  releaseOfferFlight,
  useOfferDecision,
  openRejectOfferUi,
  closeRejectOfferUi,
} from "@/features/ops/auto-accept-offer";
import { RejectDialog } from "@/features/ops/reject-dialog";
import { markOfferRejected } from "@/features/ops/rejected-offers";
import { useOps } from "@/features/ops/ops-provider";
import { useToast } from "@/components/providers/toast-provider";
import { liveStatusPatch } from "@/lib/tasks/merge-live-task";
import { ROUTES } from "@/lib/constants/routes";
import {
  canRejectOffer,
  isAssignedPendingStart,
  isOfferedTask,
  offerWindowEnd,
} from "@/types/agent";
import { isClosedTask } from "@/features/tasks/lib/workflow";
import type { Task } from "@/types/task";

type OfferActionsProps = {
  task: Task;
};

export function OfferActions({ task }: OfferActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const ops = useOps();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const decision = useOfferDecision(task.id);
  const offered = isOfferedTask(task) && !isClosedTask(task);
  const assigned = isAssignedPendingStart(task) && !isClosedTask(task);
  const canReject = canRejectOffer(task);
  const rejectLocked =
    decision.flight === "reject" || decision.settled !== "none";
  const acceptLocked =
    pending ||
    decision.flight !== "none" ||
    decision.settled !== "none" ||
    decision.rejectUiOpen;

  if (!offered && !assigned) {
    return null;
  }

  function done(patch?: Partial<Task>) {
    if (patch) ops?.patchLiveTask(task.id, patch, task);
    ops?.dismissOffer();
    ops?.refresh();
    router.refresh();
  }

  function rejected() {
    markOfferRejected(task.id);
    ops?.dropLiveTask(task.id);
    ops?.dismissOffer();
    const onTaskPage =
      pathname === ROUTES.task(task.id) ||
      pathname.startsWith(`${ROUTES.task(task.id)}/`);
    if (onTaskPage) {
      router.replace(ROUTES.tasks);
      return;
    }
    ops?.refresh();
    router.refresh();
  }

  function openReject() {
    if (decision.settled !== "none" || decision.flight === "reject") return;
    openRejectOfferUi(task.id);
    setRejectOpen(true);
  }

  function closeReject() {
    setRejectOpen(false);
    closeRejectOfferUi(task.id, offerWindowEnd(task));
  }

  function accept() {
    if (!beginAcceptOffer(task.id)) {
      toast("This offer was already accepted or rejected.", "error");
      return;
    }
    startTransition(async () => {
      try {
        const result = await acceptTaskAction(task.id);
        if (isRejectingOrRejected(task.id)) return;
        if (!result.ok) {
          releaseOfferFlight(task.id);
          toast(result.message, "error");
          return;
        }
        markOfferAccepted(task.id);
        toast("Task accepted.", "success");
        done(liveStatusPatch("ASSIGNED", "assigned"));
      } catch (error) {
        releaseOfferFlight(task.id);
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
          <Button type="button" loading={pending && decision.flight === "accept"} disabled={acceptLocked} onClick={accept}>
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
            disabled={rejectLocked}
            onClick={openReject}
          >
            Reject
          </Button>
        ) : null}
      </div>
      <RejectDialog
        taskId={rejectOpen ? task.id : null}
        open={rejectOpen}
        onClose={closeReject}
        onBegin={() => {
          ops?.silenceOffer(task.id);
        }}
        onFail={() => {
          ops?.refresh();
          router.refresh();
        }}
        onDone={rejected}
      />
    </>
  );
}
