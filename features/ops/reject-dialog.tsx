"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import {
  beginRejectOffer,
  markOfferDecisionRejected,
  submitRejectOffer,
  useOfferDecision,
} from "@/features/ops/auto-accept-offer";
import { useToast } from "@/components/providers/toast-provider";

type RejectDialogProps = {
  taskId: string | null;
  expiresAt?: string;
  open: boolean;
  onClose: () => void;
  onBegin?: () => void;
  onRejected?: () => void;
  onAlreadyAccepted?: () => void;
  onExpired?: () => void;
  onFail?: () => void;
};

export function RejectDialog({
  taskId,
  expiresAt,
  open,
  onClose,
  onBegin,
  onRejected,
  onAlreadyAccepted,
  onExpired,
  onFail,
}: RejectDialogProps) {
  const { toast } = useToast();
  const decision = useOfferDecision(taskId ?? undefined);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const trimmed = reason.trim();
  const processing = pending || decision.flight === "reject";

  function handleClose() {
    if (processing) return;
    onClose();
  }

  function submit() {
    if (!taskId || trimmed.length < 1 || processing) return;
    if (!beginRejectOffer(taskId)) {
      toast("This task was already accepted.", "info");
      onAlreadyAccepted?.();
      return;
    }
    onBegin?.();
    startTransition(async () => {
      try {
        const result = await submitRejectOffer(taskId, trimmed);
        if (result.ok) {
          markOfferDecisionRejected(taskId);
          toast("Task rejected and re-queued.", "success");
          setReason("");
          onClose();
          onRejected?.();
          return;
        }
        if (result.reason === "already_accepted") {
          toast(result.message, "info");
          onClose();
          onAlreadyAccepted?.();
          return;
        }
        if (result.reason === "expired") {
          toast(result.message, "info");
          onClose();
          onExpired?.();
          return;
        }
        toast(result.message, "error");
        onFail?.();
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not reject this task.",
          "error",
        );
        onFail?.();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Reject this task?"
      description="The 30-second timer keeps running. Submit before it hits 0 or this task is accepted for you."
    >
      {taskId && expiresAt ? (
        <div className="mb-3">
          <OfferCountdown expiresAt={expiresAt} taskId={taskId} size="lg" />
        </div>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-foreground">Reason</span>
        <Textarea
          className="mt-1.5"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Already at capacity this hour"
          maxLength={500}
          required
          disabled={processing}
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={handleClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={processing}
          disabled={!trimmed || processing}
          onClick={submit}
        >
          {processing ? "Rejecting…" : "Reject task"}
        </Button>
      </div>
    </Dialog>
  );
}
