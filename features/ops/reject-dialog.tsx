"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronIcon } from "@/components/ui/chevron-icon";
import { Textarea } from "@/components/ui/textarea";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import {
  beginRejectOffer,
  markOfferDecisionRejected,
  submitRejectOffer,
  useOfferDecision,
} from "@/features/ops/auto-accept-offer";
import { useToast } from "@/components/providers/toast-provider";
import { ASSIGN_REJECT_GRACE_MS } from "@/types/agent";

const REJECT_REASON_OPTIONS = [
  { value: "Already at capacity", label: "Already at capacity" },
  { value: "Outside my skills / category", label: "Outside my skills / category" },
  { value: "Cannot complete in time", label: "Cannot complete in time" },
  { value: "Technical issue on my side", label: "Technical issue on my side" },
  { value: "Personal emergency", label: "Personal emergency" },
  { value: "other", label: "Other (write your reason)" },
] as const;

type RejectReasonValue = (typeof REJECT_REASON_OPTIONS)[number]["value"];

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
  const [choice, setChoice] = useState<RejectReasonValue | "">("");
  const [otherReason, setOtherReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const graceExpiredFired = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const processing = pending || decision.flight === "reject";
  const countdownEnd = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const graceEnd = Number.isFinite(countdownEnd)
    ? countdownEnd + ASSIGN_REJECT_GRACE_MS
    : Number.NaN;
  const pastGrace = Number.isFinite(graceEnd) && now >= graceEnd;
  // Block submit only after Nest grace — not when the 30s UI hits 0.
  const expired = pastGrace && decision.flight !== "reject";
  const inGrace =
    Number.isFinite(countdownEnd) &&
    now >= countdownEnd &&
    !pastGrace &&
    decision.flight !== "reject";
  const finalReason =
    choice === "other" ? otherReason.trim() : choice.trim();
  const canSubmit =
    !processing && !expired && choice !== "" && finalReason.length > 0;

  useEffect(() => {
    if (!open) {
      setChoice("");
      setOtherReason("");
      graceExpiredFired.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [open, expiresAt]);

  useEffect(() => {
    if (!open || !pastGrace || processing || graceExpiredFired.current) return;
    graceExpiredFired.current = true;
    onExpiredRef.current?.();
  }, [open, pastGrace, processing]);

  function handleClose() {
    if (processing) return;
    onClose();
  }

  function submit() {
    if (!taskId || !canSubmit) return;
    if (!beginRejectOffer(taskId, expiresAt)) {
      toast("This task was already accepted.", "info");
      onAlreadyAccepted?.();
      return;
    }
    onBegin?.();
    startTransition(async () => {
      try {
        const result = await submitRejectOffer(taskId, finalReason);
        if (result.ok) {
          markOfferDecisionRejected(taskId);
          toast("Task rejected and re-queued.", "success");
          setChoice("");
          setOtherReason("");
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
        // API rejected (grace over / assigned) — refresh task state.
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

  const description = expired
    ? "The reject window ended. This task is being accepted."
    : inGrace
      ? "Countdown ended — Nest still accepts Reject for a few more seconds."
      : "The 30-second timer keeps running. Nest allows a short grace after 0.";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Reject this task?"
      description={description}
    >
      {taskId && expiresAt ? (
        <div className="mb-3">
          <OfferCountdown expiresAt={expiresAt} taskId={taskId} size="lg" />
        </div>
      ) : null}

      <label className="block" htmlFor="reject-reason-select">
        <span className="text-sm font-medium text-foreground">Reason</span>
        <div className="relative mt-1.5">
          <select
            id="reject-reason-select"
            value={choice}
            disabled={processing || expired}
            onChange={(event) =>
              setChoice(event.target.value as RejectReasonValue | "")
            }
            className="h-[45px] w-full appearance-none rounded-[5px] border border-border bg-surface px-[15px] pr-10 text-[14px] tracking-[-0.05em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="" disabled>
              Select a reason
            </option>
            {REJECT_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronIcon className="pointer-events-none absolute top-1/2 right-3 size-[15px] -translate-y-1/2 text-muted" />
        </div>
      </label>

      {choice === "other" ? (
        <label className="mt-3 block">
          <span className="text-sm font-medium text-foreground">
            Write your reason
          </span>
          <Textarea
            className="mt-1.5"
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            placeholder="Briefly explain why you cannot take this task"
            maxLength={500}
            required
            disabled={processing || expired}
          />
        </label>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={handleClose} disabled={processing}>
          Cancel
        </Button>
        {expired && !processing ? null : (
          <Button
            type="button"
            variant="danger"
            loading={processing}
            disabled={!canSubmit}
            onClick={submit}
          >
            {processing ? "Rejecting…" : "Reject task"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
