"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createTaskConfirmationDraftAction,
  sendTaskConfirmationDraftAction,
} from "@/features/tasks/actions/task-actions";
import { ConfirmationBackendPreview } from "@/features/tasks/components/confirmation-backend-preview";
import { ConfirmationSchemaFields } from "@/features/tasks/components/confirmation-schema-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import {
  buildConfirmationFormFields,
  buildConfirmationFormValues,
  membershipFormLine,
  missingRequiredConfirmationFields,
} from "@/lib/tasks/confirmation-form";
import { cn } from "@/lib/utils/cn";
import {
  buildConfirmationDraftBody,
  canSendTaskConfirmation,
  computeLineItemsSubtotal,
  computeSuggestedConfirmationCost,
  fieldInputType,
  isConfirmationConfirmed,
  isConfirmationDraft,
  isConfirmationPending,
  type ConfirmationFieldValue,
  type ConfirmationFormValues,
  type TaskConfirmation,
} from "@/types/confirmation";
import type { Task } from "@/types/task";

const CLOSED_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
]);

/** Always send USD to Nest; UI always shows $. */
const API_CURRENCY = "USD";
const DISPLAY_CURRENCY = "$";

type TaskConfirmationPanelProps = {
  task: Task;
  taskStatus?: string | null;
  confirmation: TaskConfirmation | null;
  disabled?: boolean;
  onDraft?: (confirmation: TaskConfirmation) => void;
  onSent?: (confirmation: TaskConfirmation) => void;
};

type FlowStep = "initial" | "waiting" | "approved";

const FLOW_STEPS: Array<{ id: FlowStep; label: string }> = [
  { id: "initial", label: "Initial" },
  { id: "waiting", label: "Waiting for client" },
  { id: "approved", label: "Approved" },
];

function flowStep(confirmation: TaskConfirmation | null): FlowStep {
  if (isConfirmationConfirmed(confirmation)) return "approved";
  if (isConfirmationPending(confirmation)) return "waiting";
  return "initial";
}

function stepHelp(
  step: FlowStep,
  confirmation: TaskConfirmation | null,
): string {
  if (confirmation?.status === "DECLINED") {
    return "The client declined. Edit the details and send again.";
  }
  if (step === "waiting") {
    return "Waiting for the customer to approve or reject.";
  }
  if (step === "approved") {
    return "Client approved. Click Complete Task to upload the receipt and finish.";
  }
  if (isConfirmationDraft(confirmation)) {
    return "Draft ready. Send it to the customer, or edit and send again.";
  }
  return "Add or edit details, then send confirmation to the client.";
}

export function TaskConfirmationPanel({
  task,
  taskStatus,
  confirmation,
  disabled = false,
  onDraft,
  onSent,
}: TaskConfirmationPanelProps) {
  const { toast } = useToast();
  const fields = useMemo(
    () => buildConfirmationFormFields(task, confirmation),
    [task, confirmation],
  );
  const membershipLine = membershipFormLine(task);

  const [fieldValues, setFieldValues] = useState<ConfirmationFormValues>(() =>
    buildConfirmationFormValues(task, fields, confirmation),
  );
  const [cost, setCost] = useState(confirmation?.cost ?? "");
  const [forceEdit, setForceEdit] = useState(false);
  const [pending, startTransition] = useTransition();

  const closed = CLOSED_STATUSES.has(taskStatus ?? "");
  const canSend = canSendTaskConfirmation(taskStatus) && !disabled && !closed;
  const isDraft = isConfirmationDraft(confirmation);
  const waiting = isConfirmationPending(confirmation);
  const approved = isConfirmationConfirmed(confirmation);
  const declined = confirmation?.status === "DECLINED";
  const step = flowStep(confirmation);

  // Editable form: open by default until sent/pending; reopen on decline/draft/edit.
  const showEditableForm =
    canSend &&
    !approved &&
    (forceEdit ||
      !confirmation ||
      isDraft ||
      declined ||
      confirmation.status === "SUPERSEDED" ||
      !waiting);

  // Hydrate when the task or confirmation identity changes — not on every
  // confirmation object refresh (that was wiping merchant/address edits).
  const fieldKeySig = fields.map((field) => field.key).join("|");
  useEffect(() => {
    setFieldValues(buildConfirmationFormValues(task, fields, confirmation));
    setCost(confirmation?.cost ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid reset on live patches
  }, [task.id, confirmation?.id, fieldKeySig]);

  useEffect(() => {
    if (!confirmation) {
      setForceEdit(false);
      return;
    }
    if (confirmation.status === "PENDING") setForceEdit(false);
    if (
      confirmation.status === "DECLINED" ||
      confirmation.status === "SUPERSEDED" ||
      confirmation.status === "DRAFT"
    ) {
      setForceEdit(true);
    }
  }, [confirmation?.id, confirmation?.status]);

  const suggestedCost = useMemo(
    () => computeSuggestedConfirmationCost(fields, fieldValues),
    [fields, fieldValues],
  );

  // Keep Total in sync with unitPrice × count or line-item totals.
  useEffect(() => {
    if (!suggestedCost) return;
    setCost(suggestedCost);
  }, [suggestedCost]);

  const missingRequired = useMemo(
    () => missingRequiredConfirmationFields(fields, fieldValues),
    [fields, fieldValues],
  );

  function updateField(key: string, value: ConfirmationFieldValue) {
    setFieldValues((current) => {
      const next: ConfirmationFormValues = { ...current, [key]: value };
      const lineField = fields.find(
        (field) => fieldInputType(field) === "lineItems",
      );
      if (
        lineField &&
        key === lineField.key &&
        fields.some((field) => field.key === "subtotal")
      ) {
        const subtotal = computeLineItemsSubtotal(next, lineField.key);
        if (subtotal) next.subtotal = subtotal;
      }
      return next;
    });
  }
  function buildBody() {
    return buildConfirmationDraftBody(
      fields,
      fieldValues,
      cost.trim() || suggestedCost || "",
      API_CURRENCY,
    );
  }

  function validate(): boolean {
    if (missingRequired.length > 0) {
      toast(
        `Fill required fields: ${missingRequired.map((f) => f.label).join(", ")}`,
        "error",
      );
      return false;
    }
    const nextCost = cost.trim() || suggestedCost || "";
    // Nest always requires cost (+ currency), even when schema says costRequired false.
    if (!nextCost) {
      toast("Enter the total amount before sending.", "error");
      return false;
    }
    return true;
  }

  /** Edit details → enter amount → send to client (draft + send). */
  function sendToClient() {
    if (!validate()) return;
    const body = buildBody();
    startTransition(async () => {
      const draftResult = await createTaskConfirmationDraftAction(task.id, body);
      if (!draftResult.ok) {
        toast(draftResult.message, "error");
        return;
      }
      onDraft?.(draftResult.confirmation);

      const sendResult = await sendTaskConfirmationDraftAction(
        task.id,
        draftResult.confirmation.id,
      );
      if (!sendResult.ok) {
        toast(
          `${sendResult.message} Draft was saved — you can send the preview above.`,
          "error",
        );
        onDraft?.(draftResult.confirmation);
        return;
      }
      toast("Confirmation sent to the client.", "success");
      setForceEdit(false);
      onSent?.(sendResult.confirmation);
    });
  }

  function saveDraftOnly() {
    if (!validate()) return;
    const body = buildBody();
    startTransition(async () => {
      const result = await createTaskConfirmationDraftAction(task.id, body);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast("Draft saved. Review it, then send to the customer.", "success");
      onDraft?.(result.confirmation);
    });
  }

  function sendExistingDraft() {
    if (!confirmation || confirmation.status !== "DRAFT") {
      toast("Save or edit the details first.", "error");
      return;
    }
    startTransition(async () => {
      const result = await sendTaskConfirmationDraftAction(
        task.id,
        confirmation.id,
      );
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast("Confirmation sent to the client.", "success");
      setForceEdit(false);
      onSent?.(result.confirmation);
    });
  }

  const stepIndex = FLOW_STEPS.findIndex((s) => s.id === step);

  return (
    <section
      id="panel-confirmation"
      className="overflow-hidden rounded-[15px] border border-border bg-surface p-5 shadow-(--shadow-card)"
    >
      <div className="min-w-0">
        <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-foreground">
          Task details
        </h2>
        <p className="mt-2 text-[16px] font-normal leading-[1.3] tracking-[-0.04em] text-muted">
          One place for client details. Status moves as you send and they reply.
        </p>
      </div>

      {/* Single card flow: Initial → Waiting → Approved */}
      <ol className="mt-5 flex items-center gap-0">
        {FLOW_STEPS.map((item, index) => {
          const done = index < stepIndex;
          const active = index === stepIndex;
          return (
            <li key={item.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[12px] font-bold",
                    done && "bg-accent text-accent-foreground",
                    active &&
                      !declined &&
                      "bg-accent text-accent-foreground ring-4 ring-accent/20",
                    active &&
                      declined &&
                      "bg-danger text-white ring-4 ring-danger/20",
                    !done &&
                      !active &&
                      "bg-surface-muted text-muted-dim",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "max-w-[6.5rem] text-[11px] font-semibold leading-tight tracking-[-0.02em]",
                    active || done ? "text-foreground" : "text-muted-dim",
                  )}
                >
                  {item.label}
                </span>
              </div>
              {index < FLOW_STEPS.length - 1 ? (
                <span
                  className={cn(
                    "mb-5 mx-1 h-0.5 min-w-[12px] flex-1 rounded-full",
                    index < stepIndex ? "bg-accent" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <p
        className={cn(
          "mt-4 text-sm",
          declined ? "font-medium text-danger" : "text-muted",
        )}
      >
        {stepHelp(step, confirmation)}
      </p>

      {confirmation && !showEditableForm ? (
        <div className="mt-4 border-t border-border pt-4">
          <ConfirmationBackendPreview confirmation={confirmation} />
          {isDraft && canSend ? (
            <div className="mt-3">
              <Button
                type="button"
                loading={pending}
                disabled={pending}
                onClick={sendExistingDraft}
              >
                Send this preview to customer
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {waiting && canSend && !showEditableForm ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-accent hover:text-accent-hover"
          onClick={() => setForceEdit(true)}
        >
          Edit details and send again
        </button>
      ) : null}

      {showEditableForm ? (
        <div className="mt-5 space-y-4 border-t border-border pt-4">
          {membershipLine ? (
            <div className="rounded-[10px] border border-accent/25 bg-accent/[0.06] px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Membership
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {membershipLine}
              </p>
              <p className="mt-1 text-xs text-muted">
                Included automatically when you send (client already agreed).
              </p>
            </div>
          ) : null}

          {fields.length > 0 ? (
            <ConfirmationSchemaFields
              fields={fields}
              values={fieldValues}
              onChange={updateField}
              disabled={pending}
            />
          ) : (
            <p className="text-sm text-muted">
              No detail fields on this task yet. Enter the amount below to send
              a confirmation.
            </p>
          )}

          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[22px] font-medium tracking-[-0.045em] text-muted">
                Total Sub
              </p>
              <p className="text-[32px] font-bold tracking-[-0.09em] text-foreground">
                {cost.trim() || suggestedCost || "—"} {DISPLAY_CURRENCY}
              </p>
            </div>
            <div className="mt-4">
              <Label
                htmlFor="confirmation-cost"
                className="mb-2 block text-[16px] font-medium tracking-[-0.04em] text-muted"
              >
                Total amount <span className="text-danger">*</span>
              </Label>
              <Input
                id="confirmation-cost"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                disabled={pending}
                placeholder={suggestedCost || "25.00"}
                inputMode="decimal"
                maxLength={40}
                className="h-[45px] rounded-[5px] border-border px-[15px] text-[14px] tracking-[-0.05em] placeholder:text-muted-dim"
              />
            </div>
          </div>

          <div className="mt-2 flex w-full items-stretch gap-[15px]">
            <Button
              disabled={pending}
              loading={pending}
              onClick={sendToClient}
              className="h-[43px] min-w-0 flex-[238] rounded-full border-transparent bg-accent px-4 text-[14px] font-medium tracking-[-0.05em] text-accent-foreground shadow-none hover:bg-accent-hover"
            >
              Send to Client
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={saveDraftOnly}
              aria-busy={pending || undefined}
              style={{ color: "var(--muted)", borderColor: "var(--muted)" }}
              className="box-border inline-flex h-[43px] min-w-0 flex-[161] items-center justify-center rounded-full border border-solid bg-transparent px-4 text-[14px] font-medium leading-none tracking-[-0.05em] transition-colors hover:border-[color:var(--foreground)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <span
                  className="mr-2 size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
                  aria-hidden
                />
              ) : null}
              Save as Draft
            </button>
          </div>
          {waiting && forceEdit ? (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-muted hover:text-foreground"
              onClick={() => setForceEdit(false)}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      ) : null}

      {!canSend && !disabled && !closed ? (
        <p className="mt-3 text-sm text-muted">
          {taskStatus === "ASSIGNED"
            ? "Start the task before you send the confirmation."
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
