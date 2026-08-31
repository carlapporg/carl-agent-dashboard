"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { sendTaskConfirmationAction } from "@/features/tasks/actions/task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import {
  canSendTaskConfirmation,
  confirmationStatusLabel,
  isConfirmationConfirmed,
  isConfirmationPending,
  type TaskConfirmation,
} from "@/types/confirmation";

const CLOSED_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
]);
import { cn } from "@/lib/utils/cn";

const DEFAULT_CURRENCY = "USD";

type TaskConfirmationPanelProps = {
  taskId: string;
  taskStatus?: string | null;
  confirmation: TaskConfirmation | null;
  disabled?: boolean;
  onSent?: (confirmation: TaskConfirmation) => void;
};

function statusVariant(
  status: TaskConfirmation["status"],
): "warning" | "success" | "danger" | "muted" {
  if (status === "PENDING") return "warning";
  if (status === "CONFIRMED") return "success";
  if (status === "DECLINED") return "danger";
  return "muted";
}

function statusHelp(status: TaskConfirmation["status"]): string {
  if (status === "PENDING") {
    return "Waiting for the customer to approve or reject the details.";
  }
  if (status === "CONFIRMED") {
    return "The client approved the details. Send payment proof next.";
  }
  if (status === "DECLINED") {
    return "The client declined. Update the details and send a new confirmation.";
  }
  return "This request was replaced by a newer one.";
}

export function TaskConfirmationPanel({
  taskId,
  taskStatus,
  confirmation,
  disabled = false,
  onSent,
}: TaskConfirmationPanelProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(confirmation?.notes ?? "");
  const [cost, setCost] = useState(confirmation?.cost ?? "");
  const [showForm, setShowForm] = useState(!confirmation);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!confirmation) return;
    setNotes((current) => current.trim() || confirmation.notes || "");
    setCost((current) => current.trim() || confirmation.cost || "");
    if (confirmation.status === "DECLINED" || confirmation.status === "SUPERSEDED") {
      setShowForm(true);
      return;
    }
    setShowForm(false);
  }, [confirmation]);

  const closed = CLOSED_STATUSES.has(taskStatus ?? "");
  const canSend = canSendTaskConfirmation(taskStatus) && !disabled && !closed;
  const waiting = isConfirmationPending(confirmation);
  const approved = isConfirmationConfirmed(confirmation);
  const declined = confirmation?.status === "DECLINED";
  const formOpen =
    canSend && (showForm || !confirmation || declined || confirmation.status === "SUPERSEDED");

  const rows = confirmation?.rows ?? [];
  const costDisplay = useMemo(() => {
    if (!confirmation) return "";
    return confirmation.costDisplay || `${confirmation.currency} ${confirmation.cost}`;
  }, [confirmation]);

  function send() {
    const nextNotes = notes.trim();
    const nextCost = cost.trim();
    if (!nextNotes || !nextCost) {
      toast("Add the final details and the total cost first.", "error");
      return;
    }
    startTransition(async () => {
      const result = await sendTaskConfirmationAction(taskId, {
        notes: nextNotes,
        cost: nextCost,
        currency: DEFAULT_CURRENCY,
      });
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast("Confirmation sent to the client.", "success");
      setShowForm(false);
      onSent?.(result.confirmation);
    });
  }

  return (
    <section
      id="panel-confirmation"
      className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Task Details Confirmation
          </h2>
          <p className="mt-1 text-sm text-muted">
            Research the request, then send the final details and cost. The task
            stays In Progress until you send this confirmation.
          </p>
        </div>
        {confirmation ? (
          <Badge variant={statusVariant(confirmation.status)}>
            {confirmationStatusLabel(confirmation.status)}
          </Badge>
        ) : null}
      </div>

      {confirmation ? (
        <div
          className={cn(
            "mt-4 rounded-xl border px-4 py-3",
            waiting && "border-amber-200 bg-amber-50",
            approved && "border-emerald-200 bg-emerald-50",
            declined && "border-red-200 bg-red-50",
            confirmation.status === "SUPERSEDED" && "border-border bg-surface-hover",
          )}
        >
          <p className="text-sm font-semibold text-foreground">
            {waiting
              ? "Waiting for Customer"
              : confirmationStatusLabel(confirmation.status)}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {statusHelp(confirmation.status)}
          </p>
          {confirmation.title ? (
            <p className="mt-2 text-sm font-semibold text-foreground">
              {confirmation.title}
            </p>
          ) : null}
          {confirmation.summary ? (
            <p className="mt-1 text-sm text-foreground-soft">
              {confirmation.summary}
            </p>
          ) : null}

          {rows.length > 0 ? (
            <dl className="mt-3 divide-y divide-black/5">
              {rows.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4"
                >
                  <dt className="w-36 shrink-0 text-sm font-medium text-muted">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : confirmation.notes ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {confirmation.notes}
            </p>
          ) : null}

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {confirmation.costLabel || "Total"}
          </p>
          <p className="text-xl font-semibold tracking-tight text-foreground">
            {costDisplay}
          </p>
        </div>
      ) : closed ? null : (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-hover px-3 py-2 text-sm text-muted">
          No confirmation sent yet. Add the details below after you finish
          research.
        </p>
      )}

      {canSend && confirmation && !formOpen ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-accent hover:text-accent-hover"
          onClick={() => setShowForm(true)}
        >
          {waiting ? "Send updated details" : "Send new details"}
        </button>
      ) : null}

      {formOpen ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <Label htmlFor="confirmation-notes">Final details</Label>
            <Textarea
              id="confirmation-notes"
              className="min-h-28"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={pending}
              placeholder="Cinema, movie, tickets, seats, time — everything the client should confirm."
              maxLength={5000}
            />
          </div>
          <div>
            <Label htmlFor="confirmation-cost">Total cost (USD)</Label>
            <Input
              id="confirmation-cost"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              disabled={pending}
              placeholder="25.00"
              inputMode="decimal"
              maxLength={40}
            />
          </div>
          <Button
            type="button"
            loading={pending}
            disabled={pending}
            onClick={send}
          >
            Send task details confirmation
          </Button>
        </div>
      ) : null}

      {!canSend && !disabled && !closed ? (
        <p className="mt-3 text-sm text-muted">
          {taskStatus === "ASSIGNED"
            ? "Start the task before you send the final confirmation."
            : "Accept the offer first, then you can send a confirmation."}
        </p>
      ) : null}
      {closed ? (
        <p className="mt-3 text-sm text-muted">
          This task is closed. You cannot send a confirmation.
        </p>
      ) : null}
    </section>
  );
}
