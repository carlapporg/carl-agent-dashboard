import type {
  ConfirmationSchemaField,
  TaskConfirmation,
} from "@/types/confirmation";
import type { Task } from "@/types/task";

/** Internal / intake keys that must not appear on the confirmation form. */
const SKIP_FORM_KEYS = new Set([
  "membershipBrand",
  "membershipId",
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

/**
 * Build the full editable confirmation field list.
 * Prefer Nest schema labels; fill gaps from prefill + task metadata.
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
    byKey.set(field.key, {
      key: field.key,
      label: field.label,
      required: field.required ?? false,
      prefillFrom: field.prefillFrom,
    });
  }

  const prefill = task.confirmationPrefill ?? {};
  for (const key of Object.keys(prefill)) {
    if (isSkippableKey(key) || byKey.has(key)) continue;
    byKey.set(key, {
      key,
      label: humanizeKey(key),
      required: false,
    });
  }

  const metadata = task.metadata;
  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (isSkippableKey(key) || byKey.has(key)) continue;
      if (scalarString(value) == null) continue;
      byKey.set(key, {
        key,
        label: humanizeKey(key),
        required: false,
      });
    }
  }

  // Ensure a free-text notes field exists for agent extras.
  if (![...byKey.keys()].some((k) => k === "notes" || k === "details")) {
    byKey.set("notes", {
      key: "notes",
      label: "Notes",
      required: false,
    });
  }

  return [...byKey.values()];
}

/** Initial editable values from prefill, metadata, membership, and prior confirmation. */
export function buildConfirmationFormValues(
  task: Task,
  fields: ConfirmationSchemaField[],
  confirmation?: TaskConfirmation | null,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) values[field.key] = "";

  const metadata = task.metadata;
  if (metadata && typeof metadata === "object") {
    for (const field of fields) {
      const fromMeta = scalarString(metadata[field.key]);
      if (fromMeta) values[field.key] = fromMeta;
    }
  }

  const prefill = task.confirmationPrefill ?? {};
  for (const field of fields) {
    const fromPrefill = scalarString(prefill[field.key]);
    if (fromPrefill) values[field.key] = fromPrefill;
  }

  // Seed from prior confirmation rows when labels match (edit / resend).
  if (confirmation?.rows?.length) {
    const byLabel = new Map(
      confirmation.rows.map((row) => [row.label.trim().toLowerCase(), row.value]),
    );
    for (const field of fields) {
      if (values[field.key]?.trim()) continue;
      const fromRow = byLabel.get(field.label.trim().toLowerCase());
      if (fromRow?.trim()) values[field.key] = fromRow.trim();
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
