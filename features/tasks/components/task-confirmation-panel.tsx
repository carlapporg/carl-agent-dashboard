"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createTaskConfirmationDraftAction,
  sendTaskConfirmationDraftAction,
} from "@/features/tasks/actions/task-actions";
import { ConfirmationBackendPreview } from "@/features/tasks/components/confirmation-backend-preview";
import { ConfirmationSchemaFields } from "@/features/tasks/components/confirmation-schema-fields";
import { Badge } from "@/components/ui/badge";
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
  confirmationStatusLabel,
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

/** Agent UI default currency. */
const DEFAULT_CURRENCY = "USD";

type TaskConfirmationPanelProps = {
  task: Task;
  taskStatus?: string | null;
  confirmation: TaskConfirmation | null;
  disabled?: boolean;
  onDraft?: (confirmation: TaskConfirmation) => void;
  onSent?: (confirmation: TaskConfirmation) => void;
};

function statusVariant(
  status: TaskConfirmation["status"],
): "warning" | "success" | "danger" | "muted" | "info" {
  if (status === "DRAFT") return "info";
  if (status === "PENDING") return "warning";
  if (status === "CONFIRMED") return "success";
  if (status === "DECLINED") return "danger";
  return "muted";
}

function statusHelp(status: TaskConfirmation["status"]): string {
  if (status === "DRAFT") {
    return "Preview ready. Send it to the customer, or edit the fields and send again.";
  }
  if (status === "PENDING") {
    return "Waiting for the customer to approve or reject the details.";
  }
  if (status === "CONFIRMED") {
    return "The client approved the details. Click Complete Task to upload the receipt and finish.";
  }
  if (status === "DECLINED") {
    return "The client declined. Edit the details below and send again.";
  }
  return "This request was replaced by a newer one.";
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
  const [currency, setCurrency] = useState(
    confirmation?.currency || DEFAULT_CURRENCY,
  );
  const [forceEdit, setForceEdit] = useState(false);
  const [pending, startTransition] = useTransition();

  const closed = CLOSED_STATUSES.has(taskStatus ?? "");
  const canSend = canSendTaskConfirmation(taskStatus) && !disabled && !closed;
  const isDraft = isConfirmationDraft(confirmation);
  const waiting = isConfirmationPending(confirmation);
  const approved = isConfirmationConfirmed(confirmation);
  const declined = confirmation?.status === "DECLINED";

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
    setCurrency(confirmation?.currency || DEFAULT_CURRENCY);
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
      currency.trim() || DEFAULT_CURRENCY,
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
    if (!currency.trim()) {
      toast("Currency is required.", "error");
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
            Edit any task details, enter the total amount (default{" "}
            {DEFAULT_CURRENCY}), then send the confirmation to the client.
            {task.taskType ? (
              <>
                {" "}
                Type:{" "}
                <span className="font-medium text-foreground-soft">
                  {task.taskType.replaceAll("_", " ")}
                </span>
              </>
            ) : null}
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
            isDraft && "border-sky-200 bg-sky-50",
            waiting && "border-amber-200 bg-amber-50",
            approved && "border-emerald-200 bg-emerald-50",
            declined && "border-red-200 bg-red-50",
            confirmation.status === "SUPERSEDED" &&
              "border-border bg-surface-hover",
          )}
        >
          <p className="text-sm font-semibold text-foreground">
            {isDraft
              ? "Draft preview"
              : waiting
                ? "Waiting for Customer"
                : confirmationStatusLabel(confirmation.status)}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {statusHelp(confirmation.status)}
          </p>
          <ConfirmationBackendPreview
            confirmation={confirmation}
            className="mt-3"
          />
          {isDraft && canSend && !showEditableForm ? (
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
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">
            Confirmation details
          </p>
          <p className="text-sm text-muted">
            Edit confirmation details if the client asks to change them.
            Changes are sent on the confirmation draft.
          </p>

          {membershipLine ? (
            <div className="rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2.5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="confirmation-cost">
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
              />
              {suggestedCost ? (
                <p className="mt-1 text-xs text-muted">
                  Suggested from prices above: {suggestedCost}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="confirmation-currency">
                Currency <span className="text-danger">*</span>
              </Label>
              <Input
                id="confirmation-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                disabled={pending}
                placeholder={DEFAULT_CURRENCY}
                maxLength={10}
              />
              <p className="mt-1 text-xs text-muted">
                Always sent with the draft. Default is {DEFAULT_CURRENCY}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              loading={pending}
              disabled={pending}
              onClick={sendToClient}
            >
              Send confirmation to client
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              disabled={pending}
              onClick={saveDraftOnly}
            >
              Save draft preview
            </Button>
            {waiting && forceEdit ? (
              <button
                type="button"
                className="text-sm font-semibold text-muted hover:text-foreground"
                onClick={() => setForceEdit(false)}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
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
