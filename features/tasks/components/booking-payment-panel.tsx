"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  cancelTaskPaymentAction,
  requestTaskPaymentAction,
  revealTaskPaymentCardAction,
} from "@/features/tasks/actions/task-actions";
import { useOps } from "@/features/ops/ops-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import {
  patchStoredTaskPayment,
  readStoredTaskPayment,
  rememberTaskPayment,
} from "@/lib/tasks/task-payment-store";
import { cn } from "@/lib/utils/cn";
import { isConfirmationConfirmed } from "@/types/confirmation";
import type { TaskConfirmation } from "@/types/confirmation";
import {
  canCancelTaskPayment,
  canRevealTaskCard,
  dollarsToSpendCents,
  formatCardExp,
  formatPan,
  mergePaymentStatus,
  taskPaymentStatusLabel,
  type TaskPayment,
  type VirtualCardSecrets,
} from "@/types/task-payment";

type BookingPaymentPanelProps = {
  taskId: string;
  confirmation: TaskConfirmation | null;
  disabled?: boolean;
};

function statusVariant(
  status: TaskPayment["status"],
): "warning" | "success" | "danger" | "muted" | "info" | "accent" {
  if (status === "requires_payment") return "warning";
  if (status === "captured") return "info";
  if (status === "card_issued") return "accent";
  if (status === "spent") return "success";
  if (status === "cancelled" || status === "failed" || status === "expired") {
    return "danger";
  }
  return "muted";
}

function CopyButton({
  label,
  value,
  disabled,
}: {
  label: string;
  value: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  return (
    <Button
      type="button"
      variant="secondary"
      className="h-8 px-2.5 text-xs"
      disabled={disabled || !value}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => toast(`${label} copied`, "success"),
          () => toast(`Could not copy ${label.toLowerCase()}`, "error"),
        );
      }}
    >
      Copy {label}
    </Button>
  );
}

export function BookingPaymentPanel({
  taskId,
  confirmation,
  disabled = false,
}: BookingPaymentPanelProps) {
  const { toast } = useToast();
  const ops = useOps();
  const [pending, startTransition] = useTransition();
  const [spendDollars, setSpendDollars] = useState("");
  const [payment, setPayment] = useState<TaskPayment | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [secrets, setSecrets] = useState<VirtualCardSecrets | null>(null);
  const [secretsBlurred, setSecretsBlurred] = useState(false);
  const [revealPending, setRevealPending] = useState(false);

  const confirmed = isConfirmationConfirmed(confirmation);

  const applyPayment = useCallback((next: TaskPayment) => {
    setPayment(next);
    rememberTaskPayment(next);
    if (
      next.status === "cancelled" ||
      next.status === "failed" ||
      next.status === "expired"
    ) {
      // Keep id in storage so relaunch still knows, but UI can dismiss.
    }
  }, []);

  useEffect(() => {
    const stored = readStoredTaskPayment(taskId);
    if (!stored) return;
    setPayment((current) => {
      const nextStatus = mergePaymentStatus(current?.status, stored.status);
      if (
        current?.id === stored.paymentId &&
        current.status === nextStatus &&
        (current.last4 ?? null) === (stored.last4 ?? null)
      ) {
        return current;
      }
      return {
        id: stored.paymentId,
        taskId: stored.taskId,
        confirmationId: current?.confirmationId ?? confirmation?.id ?? null,
        userId: current?.userId ?? "",
        requestedByAgentId: current?.requestedByAgentId ?? "",
        spendAmountCents:
          current?.spendAmountCents ??
          Math.round(Number(stored.spendDisplay ?? "0") * 100),
        chargeAmountCents: current?.chargeAmountCents ?? 0,
        feeEstimateCents: current?.feeEstimateCents ?? 0,
        spendDisplay:
          current?.spendDisplay ?? stored.spendDisplay ?? "—",
        chargeDisplay: current?.chargeDisplay ?? stored.chargeDisplay ?? "—",
        currency: stored.currency ?? current?.currency ?? "usd",
        status: nextStatus,
        last4: stored.last4 ?? current?.last4 ?? null,
        brand: stored.brand ?? current?.brand ?? null,
        hasCard: Boolean(stored.last4 ?? current?.last4),
        paidAt: current?.paidAt ?? null,
        expiresAt: current?.expiresAt ?? null,
        createdAt: current?.createdAt ?? stored.updatedAt,
        updatedAt: stored.updatedAt,
      };
    });
  }, [confirmation?.id, taskId]);

  const liveForTask =
    ops?.paymentsByTaskId?.[taskId] ??
    (ops?.livePayment?.taskId === taskId ? ops.livePayment : null);

  useEffect(() => {
    const live = liveForTask;
    if (!live) return;
    setPayment((prev) => {
      const nextStatus = mergePaymentStatus(prev?.status, live.status);
      const next: TaskPayment = {
        id: live.paymentId || prev?.id || "",
        taskId,
        confirmationId: prev?.confirmationId ?? confirmation?.id ?? null,
        userId: prev?.userId ?? "",
        requestedByAgentId: prev?.requestedByAgentId ?? "",
        spendAmountCents:
          live.spendAmountCents ?? prev?.spendAmountCents ?? 0,
        chargeAmountCents: prev?.chargeAmountCents ?? 0,
        feeEstimateCents: prev?.feeEstimateCents ?? 0,
        spendDisplay:
          live.spendAmountCents != null
            ? (live.spendAmountCents / 100).toFixed(2)
            : (prev?.spendDisplay ?? "—"),
        chargeDisplay: prev?.chargeDisplay ?? "—",
        currency: live.currency ?? prev?.currency ?? "usd",
        status: nextStatus,
        last4: live.last4 ?? prev?.last4 ?? null,
        brand: live.brand ?? prev?.brand ?? null,
        hasCard: Boolean(live.last4 ?? prev?.last4),
        paidAt: prev?.paidAt ?? null,
        expiresAt: prev?.expiresAt ?? null,
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date(live.at).toISOString(),
      };
      if (!next.id) return prev;
      if (
        prev &&
        prev.id === next.id &&
        prev.status === next.status &&
        prev.last4 === next.last4
      ) {
        return prev;
      }
      rememberTaskPayment(next);
      return next;
    });
  }, [
    confirmation?.id,
    liveForTask,
    liveForTask?.at,
    liveForTask?.status,
    liveForTask?.last4,
    liveForTask?.paymentId,
    taskId,
  ]);

  useEffect(() => {
    if (!revealOpen) return;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        setSecretsBlurred(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [revealOpen]);

  function requestPayment(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || disabled || pending) return;
    const cents = dollarsToSpendCents(spendDollars);
    if (cents == null) {
      toast("Enter a spend amount of at least $0.01.", "error");
      return;
    }
    startTransition(async () => {
      const result = await requestTaskPaymentAction(
        taskId,
        cents,
        confirmation?.id,
      );
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      applyPayment(result.payment);
      setSpendDollars("");
      toast("Payment requested. Waiting for the customer.", "success");
    });
  }

  function onCancel() {
    if (!payment) return;
    startTransition(async () => {
      const result = await cancelTaskPaymentAction(taskId, payment.id);
      if (!result.ok) {
        toast(result.message, "error");
        setConfirmCancel(false);
        return;
      }
      applyPayment(result.payment);
      setConfirmCancel(false);
      setRevealOpen(false);
      setSecrets(null);
      toast("Payment request cancelled.", "success");
    });
  }

  function onReveal() {
    if (!payment || !canRevealTaskCard(payment.status)) return;
    setRevealPending(true);
    startTransition(async () => {
      const result = await revealTaskPaymentCardAction(taskId, payment.id);
      setRevealPending(false);
      if (!result.ok) {
        toast(result.message, "error");
        if (result.message.toLowerCase().includes("cancel")) {
          setPayment((prev) =>
            prev
              ? { ...prev, status: "cancelled", hasCard: false }
              : prev,
          );
          patchStoredTaskPayment(taskId, { status: "cancelled" });
        }
        return;
      }
      setSecrets(result.card);
      setSecretsBlurred(false);
      setRevealOpen(true);
    });
  }

  function closeReveal(paidMerchant?: boolean) {
    setRevealOpen(false);
    setSecrets(null);
    setSecretsBlurred(false);
    if (paidMerchant) {
      toast(
        "Upload the receipt and complete the task when you’re done.",
        "success",
      );
    }
  }

  const terminal =
    payment?.status === "cancelled" ||
    payment?.status === "failed" ||
    payment?.status === "expired";
  const openFlow = Boolean(payment && !terminal);

  return (
    <section
      id="panel-payment"
      className="scroll-mt-24 overflow-hidden rounded-[15px] border border-border bg-surface p-4 shadow-(--shadow-card)"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Booking payment
        </h2>
        {payment ? (
          <Badge variant={statusVariant(payment.status)}>
            {taskPaymentStatusLabel(payment.status)}
          </Badge>
        ) : null}
      </div>

      {!confirmed ? (
        <p className="mt-3 text-sm text-muted">
          User must confirm booking details before you can request payment.
        </p>
      ) : null}

      {confirmed && !openFlow ? (
        <form className="mt-4 space-y-3" onSubmit={requestPayment}>
          {terminal && payment ? (
            <p className="text-sm text-muted">
              Last request: {taskPaymentStatusLabel(payment.status)}. Start a
              new one below.
            </p>
          ) : null}
          <div className="max-w-[12rem]">
            <Label htmlFor="booking-spend">Merchant spend ($)</Label>
            <Input
              id="booking-spend"
              inputMode="decimal"
              placeholder="85.00"
              value={spendDollars}
              onChange={(event) => setSpendDollars(event.target.value)}
              disabled={disabled || pending}
              className="mt-1.5"
            />
          </div>
          <p className="text-xs text-muted">
            Customer will be charged a bit more to cover card fees (~2.9% +
            $0.30). You only spend up to the amount you enter.
          </p>
          <Button
            type="submit"
            disabled={disabled || pending || !spendDollars.trim()}
            loading={pending}
          >
            Request payment
          </Button>
        </form>
      ) : null}

      {openFlow && payment ? (
        <div className="mt-4 space-y-3">
          {payment.status === "requires_payment" ? (
            <p className="text-sm text-foreground">
              Waiting for customer to pay ${payment.chargeDisplay}.
            </p>
          ) : null}
          {payment.status === "captured" ? (
            <p className="text-sm text-foreground">
              Payment received — issuing card…
            </p>
          ) : null}
          {payment.status === "card_issued" ? (
            <p className="text-sm text-foreground">
              Card ready
              {payment.last4 ? ` · •••• ${payment.last4}` : ""}.
            </p>
          ) : null}
          {payment.status === "spent" ? (
            <p className="text-sm text-foreground">
              Card used
              {payment.last4 ? ` · •••• ${payment.last4}` : ""}. Continue with
              receipt / complete task.
            </p>
          ) : null}

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Your spend limit</dt>
              <dd className="font-semibold text-foreground">
                ${payment.spendDisplay}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Customer pays</dt>
              <dd className="font-semibold text-foreground">
                ${payment.chargeDisplay}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {canRevealTaskCard(payment.status) ? (
              <Button
                type="button"
                onClick={onReveal}
                loading={revealPending || pending}
                disabled={disabled}
              >
                Reveal card
              </Button>
            ) : null}
            {canCancelTaskPayment(payment.status) ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmCancel(true)}
                disabled={disabled || pending}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={onCancel}
        title="Cancel payment request?"
        description="User will no longer be charged / card will be voided."
        confirmLabel="Cancel request"
        cancelLabel="Keep"
        loading={pending}
        destructive
      />

      <Dialog
        open={revealOpen && Boolean(secrets)}
        onClose={() => closeReveal(false)}
        title="Virtual card"
        description="One-time card. Pay the merchant now, then finish the task."
        className="max-w-md"
      >
        {secrets ? (
          <div
            className={cn(
              "space-y-4 transition-[filter]",
              secretsBlurred && "blur-md select-none",
            )}
          >
            {secretsBlurred ? (
              <button
                type="button"
                className="w-full rounded-[var(--radius-md)] border border-border bg-surface-muted px-3 py-6 text-sm font-semibold text-foreground"
                onClick={() => setSecretsBlurred(false)}
              >
                App was backgrounded. Tap to show card again.
              </button>
            ) : null}
            <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Card number
              </p>
              <p className="mt-1 font-mono text-lg tracking-wide text-foreground">
                {formatPan(secrets.number)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Exp</p>
                  <p className="font-mono font-semibold text-foreground">
                    {formatCardExp(secrets.expMonth, secrets.expYear)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">CVC</p>
                  <p className="font-mono font-semibold text-foreground">
                    {secrets.cvc || "—"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                {(secrets.brand || "Card").toString()}
                {secrets.last4 ? ` · •••• ${secrets.last4}` : ""}
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              Do not charge more than $
              {(secrets.spendAmountCents / 100).toFixed(2)}.
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                label="Number"
                value={(secrets.number || "").replace(/\s+/g, "")}
                disabled={secretsBlurred}
              />
              <CopyButton
                label="CVC"
                value={secrets.cvc || ""}
                disabled={secretsBlurred}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" onClick={() => closeReveal(true)}>
                I’ve paid the merchant
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => closeReveal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}
