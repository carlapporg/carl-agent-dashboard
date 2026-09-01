"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  startTaskAction,
} from "@/features/tasks/actions/task-actions";
import {
  autoAcceptExpiredOffer,
  beginAcceptOffer,
  canShowRejectUi,
  hasOpenRejectUi,
  isOfferAcceptLocked,
  isRejectingOrRejected,
  markOfferAccepted,
  submitAcceptOffer,
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
  isOfferRejectWindowOpen,
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
  const decision = useOfferDecision(task.id);
  const rejecting = isRejectingOrRejected(task.id);
  const offered =
    (isOfferedTask(task) || hasOpenRejectUi(task.id)) && !isClosedTask(task);
  const assigned = isAssignedPendingStart(task) && !isClosedTask(task);
  const windowOpen = isOfferRejectWindowOpen(task) && !decision.windowExpired;
  const showReject =
    canRejectOffer(task) &&
    canShowRejectUi(task.id) &&
    (windowOpen || decision.flight === "reject");
  const acceptLocked = pending || isOfferAcceptLocked(task.id);
  const dialogOpen =
    decision.rejectUiOpen &&
    decision.settled !== "rejected" &&
    (showReject || decision.flight === "reject");

  if (!offered && !assigned && !rejecting) {
    return null;
  }

  function done(patch?: Partial<Task>) {
    if (patch) ops?.patchLiveTask(task.id, patch, task);
    ops?.silenceOffer(task.id);
    ops?.refresh();
    router.refresh();
  }

  function rejected() {
    markOfferRejected(task.id);
    ops?.dropLiveTask(task.id);
    ops?.silenceOffer(task.id);
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
    if (decision.settled !== "none" || decision.windowExpired) return;
    if (!isOfferRejectWindowOpen(task)) return;
    openRejectOfferUi(task.id, offerWindowEnd(task));
  }

  function closeReject() {
    closeRejectOfferUi(task.id, offerWindowEnd(task));
  }

  function accept() {
    if (decision.flight !== "none" || decision.settled !== "none") return;
    if (!beginAcceptOffer(task.id, offerWindowEnd(task))) return;
    startTransition(async () => {
      const result = await submitAcceptOffer(task.id);
      if (result.ok) {
        toast("Task accepted.", "success");
        done(liveStatusPatch("ASSIGNED", "assigned"));
        return;
      }
      if (result.reason === "already_accepted") {
        markOfferAccepted(task.id);
        done(liveStatusPatch("ASSIGNED", "assigned"));
        return;
      }
      toast(result.message, "error");
      ops?.refresh();
      router.refresh();
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
        {decision.flight === "reject" ? (
          <Button type="button" disabled>
            Rejecting…
          </Button>
        ) : offered ? (
          <Button
            type="button"
            loading={pending && decision.flight === "accept"}
            disabled={acceptLocked}
            onClick={accept}
          >
            {decision.flight === "accept" || decision.settled === "accepted"
              ? "Accepting…"
              : "Accept"}
          </Button>
        ) : (
          <Button type="button" loading={pending} disabled={pending} onClick={start}>
            Start
          </Button>
        )}
        {showReject ? (
          <Button
            type="button"
            variant="secondary"
            disabled={
              acceptLocked ||
              decision.flight !== "none" ||
              decision.settled !== "none" ||
              decision.windowExpired
            }
            onClick={openReject}
          >
            Reject
          </Button>
        ) : null}
      </div>
      <RejectDialog
        taskId={task.id}
        expiresAt={offerWindowEnd(task)}
        open={dialogOpen}
        onClose={closeReject}
        onRejected={rejected}
        onAlreadyAccepted={() => {
          markOfferAccepted(task.id);
          toast("Task accepted.", "success");
          done(liveStatusPatch("ASSIGNED", "assigned"));
        }}
        onExpired={() => {
          void autoAcceptExpiredOffer(task.id).then((ok) => {
            if (ok) {
              toast("Task accepted.", "success");
              done(liveStatusPatch("ASSIGNED", "assigned"));
              return;
            }
            ops?.refresh();
            router.refresh();
          });
        }}
        onFail={() => {
          ops?.refresh();
          router.refresh();
        }}
      />
    </>
  );
}
