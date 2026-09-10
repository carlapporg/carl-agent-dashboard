import type {
  ConfirmationFieldValue,
  ConfirmationFormValues,
  ConfirmationLineItemValue,
  ConfirmationSchemaField,
  TaskConfirmation,
} from "@/types/confirmation";
import {
  asFieldText,
  DRAFT_CONFIRMATION_NOTES_FIELDS,
  emptyLineItem,
  fieldInputType,
  isDraftConfirmationEditableField,
  isLineItemsValue,
} from "@/types/confirmation";
import type { Task } from "@/types/task";

/** Internal / intake keys that must not appear on the confirmation form. */
const SKIP_FORM_KEYS = new Set([
  "pendingMembershipBrand",
  "pendingMembershipId",
  "membershipConfirmed",
  "assignmentSearchStartedAt",
  "assignmentStartedAt",
  "assignedAt",
  "offeredAt",
  "queuedAt",
  "socketId",
  "agentId",
  "userId",
  "cost",
  "currency",
  "deliveryFee",
  "tax",
]);

function titleCase(value: string): string {
  return value
    .split(/([\s,/-]+)/)
    .map((part) => {
      if (!/[a-zA-Z]/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return titleCase(spaced);
}

function isSkippableKey(key: string): boolean {
  if (SKIP_FORM_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  if (lower.startsWith("pending")) return true;
  if (lower.includes("assignmentsearch")) return true;
  if (lower.endsWith("at") && /started|offered|queued|assigned|updated|created/i.test(key)) {
    return true;
  }
  return false;
}

function scalarString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "object") return null;
  const text = String(raw).trim();
  return text || null;
}

function lineItemsFromUnknown(raw: unknown): ConfirmationLineItemValue[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ConfirmationLineItemValue[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const name = row.name == null ? "" : String(row.name).trim();
    const unitPrice =
      row.unitPrice == null ? "" : String(row.unitPrice).trim();
    const quantity =
      row.quantity == null || row.quantity === ""
        ? "1"
        : String(row.quantity).trim();
    if (!name && !unitPrice) continue;
    items.push({ name, quantity: quantity || "1", unitPrice });
  }
  return items.length > 0 ? items : null;
}

function lookupPath(
  source: Record<string, unknown> | null | undefined,
  path: string,
): unknown {
  if (!source || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(source, path)) {
    return source[path];
  }
  const parts = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function emptyValueForField(
  field: ConfirmationSchemaField,
): ConfirmationFieldValue {
  return fieldInputType(field) === "lineItems" ? [emptyLineItem()] : "";
}

/** Date/time must be filled before send (Nest schema often marks them optional). */
function isDateOrTimeField(
  field: Pick<ConfirmationSchemaField, "key" | "label">,
): boolean {
  const key = field.key.trim().toLowerCase();
  const label = field.label?.trim().toLowerCase() ?? "";
  if (
    key === "date" ||
    key === "time" ||
    key === "pickuptime" ||
    key === "departuredate" ||
    key === "departuretime"
  ) {
    return true;
  }
  return (
    label === "date" ||
    label === "time" ||
    label === "pickup time" ||
    label === "departure date" ||
    label === "departure time"
  );
}

function withRequiredFlags(
  field: ConfirmationSchemaField,
): ConfirmationSchemaField {
  if (isDateOrTimeField(field)) {
    return { ...field, required: true };
  }
  return field;
}

/**
 * Build the full editable confirmation field list.
 * Prefer Nest schema fields; only fall back to prefill/metadata when schema is empty.
 */
export function buildConfirmationFormFields(
  task: Task,
  confirmation?: TaskConfirmation | null,
): ConfirmationSchemaField[] {
  const schemaFields =
    task.confirmationSchema?.fields ??
    confirmation?.confirmationSchema?.fields ??
    [];
  const byKey = new Map<string, ConfirmationSchemaField>();

  for (const field of schemaFields) {
    if (!field.key || isSkippableKey(field.key)) continue;
    byKey.set(
      field.key,
      withRequiredFlags({
        key: field.key,
        label: field.label,
        required: field.required ?? false,
        prefillFrom: field.prefillFrom,
        inputType: field.inputType,
      }),
    );
  }

  // When Nest did not send a schema, recover editable keys from prefill/metadata.
  if (byKey.size === 0) {
    const prefill = task.confirmationPrefill ?? {};
    for (const key of Object.keys(prefill)) {
      if (isSkippableKey(key) || byKey.has(key)) continue;
      const raw = prefill[key];
      byKey.set(
        key,
        withRequiredFlags({
          key,
          label: humanizeKey(key),
          required: false,
          inputType: Array.isArray(raw) ? "lineItems" : "text",
        }),
      );
    }

    const metadata = task.metadata;
    if (metadata && typeof metadata === "object") {
      for (const [key, value] of Object.entries(metadata)) {
        if (isSkippableKey(key) || byKey.has(key)) continue;
        if (Array.isArray(value)) {
          if (lineItemsFromUnknown(value)) {
            byKey.set(
              key,
              withRequiredFlags({
                key,
                label: humanizeKey(key),
                required: false,
                inputType: "lineItems",
              }),
            );
          }
          continue;
        }
        if (scalarString(value) == null) continue;
        byKey.set(
          key,
          withRequiredFlags({
            key,
            label: humanizeKey(key),
            required: false,
          }),
        );
      }
    }
  }

  // Ensure a free-text notes field exists for agent extras.
  if (![...byKey.keys()].some((k) => k === "notes" || k === "details")) {
    byKey.set("notes", {
      key: "notes",
      label: "Notes",
      required: false,
      inputType: "text",
    });
  }

  return [...byKey.values()];
}

function resolvePrefillValue(
  field: ConfirmationSchemaField,
  task: Task,
): ConfirmationFieldValue | null {
  const prefill = task.confirmationPrefill ?? {};
  const metadata =
    task.metadata && typeof task.metadata === "object" ? task.metadata : null;

  const candidates: unknown[] = [];
  if (Object.prototype.hasOwnProperty.call(prefill, field.key)) {
    candidates.push(prefill[field.key]);
  }
  for (const path of field.prefillFrom ?? []) {
    candidates.push(lookupPath(prefill as Record<string, unknown>, path));
    candidates.push(lookupPath(metadata, path));
  }
  candidates.push(lookupPath(metadata, field.key));

  for (const candidate of candidates) {
    if (fieldInputType(field) === "lineItems") {
      const items = lineItemsFromUnknown(candidate);
      if (items) return items;
      continue;
    }
    const text = scalarString(candidate);
    if (text) return text;
  }
  return null;
}

function parseLineItemRow(value: string): ConfirmationLineItemValue | null {
  const match = value
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*[×x]\s*(.+?)\s*@\s*([\d.]+)/i);
  if (!match) return null;
  return {
    quantity: match[1],
    name: match[2].trim(),
    unitPrice: match[3],
  };
}

function parseStructuredConfirmationNotes(
  notes: string,
  fields: ConfirmationSchemaField[],
): { overrides: Record<string, string>; freeNotes: string } {
  const overrides: Record<string, string> = {};
  const freeLines: string[] = [];
  const labelToKey = new Map(
    fields.map((field) => [field.label.trim().toLowerCase(), field.key]),
  );

  for (const line of notes.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const label = trimmed.slice(0, colonIndex).trim().toLowerCase();
      const key = labelToKey.get(label);
      if (key && DRAFT_CONFIRMATION_NOTES_FIELDS.has(key)) {
        overrides[key] = trimmed.slice(colonIndex + 1).trim();
        continue;
      }
    }
    freeLines.push(trimmed);
  }

  return { overrides, freeNotes: freeLines.join("\n") };
}

function applyConfirmationRowsToValues(
  fields: ConfirmationSchemaField[],
  values: ConfirmationFormValues,
  rows: { label: string; value: string }[],
): void {
  const byLabel = new Map(
    rows.map((row) => [row.label.trim().toLowerCase(), row.value]),
  );

  for (const field of fields) {
    if (fieldInputType(field) === "lineItems") continue;
    const fromRow = byLabel.get(field.label.trim().toLowerCase());
    if (fromRow?.trim()) values[field.key] = fromRow.trim();
  }

  const lineField = fields.find(
    (field) => fieldInputType(field) === "lineItems",
  );
  if (lineField) {
    const items: ConfirmationLineItemValue[] = [];
    for (const row of rows) {
      const label = row.label.trim().toLowerCase();
      if (
        /^item\s+\d+$/.test(label) ||
        label === lineField.label.trim().toLowerCase()
      ) {
        const parsed = parseLineItemRow(row.value);
        if (parsed) items.push(parsed);
      }
    }
    if (items.length > 0) values[lineField.key] = items;
  }
}

/** Initial editable values from prefill, metadata, membership, and prior confirmation. */
export function buildConfirmationFormValues(
  task: Task,
  fields: ConfirmationSchemaField[],
  confirmation?: TaskConfirmation | null,
): ConfirmationFormValues {
  const values: ConfirmationFormValues = {};
  for (const field of fields) {
    values[field.key] = emptyValueForField(field);
  }

  for (const field of fields) {
    const resolved = resolvePrefillValue(field, task);
    if (resolved != null) values[field.key] = resolved;
  }

  // Saved draft / sent confirmation wins over task prefill (edit / resend).
  if (confirmation?.rows?.length) {
    applyConfirmationRowsToValues(fields, values, confirmation.rows);
  }

  if (confirmation?.notes?.trim()) {
    const { overrides, freeNotes } = parseStructuredConfirmationNotes(
      confirmation.notes,
      fields,
    );
    for (const [key, value] of Object.entries(overrides)) {
      values[key] = value;
    }
    const notesField = fields.find(
      (field) => field.key === "notes" || field.key === "details",
    );
    if (notesField) {
      values[notesField.key] = freeNotes;
    }
  }

  return values;
}

export function membershipFormLine(task: Task): string | null {
  const membership = task.membership;
  if (!membership?.brand?.trim() || !membership.membershipId?.trim()) {
    return null;
  }
  return `${membership.brand.trim()} — ${membership.membershipId.trim()}`;
}

/** Required editable draft fields that are still empty (skips metadata-only keys). */
export function missingRequiredConfirmationFields(
  fields: ConfirmationSchemaField[],
  values: ConfirmationFormValues,
): ConfirmationSchemaField[] {
  return fields.filter((field) => {
    if (!field.required) return false;
    if (!isDraftConfirmationEditableField(field)) return false;
    if (fieldInputType(field) === "lineItems") {
      const raw = values[field.key];
      const items = isLineItemsValue(raw) ? raw : [];
      return !items.some(
        (item) =>
          item.name.trim() &&
          item.unitPrice.trim() &&
          item.quantity.trim(),
      );
    }
    return !asFieldText(values[field.key]).trim();
  });
}
