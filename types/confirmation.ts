import { z } from "zod";

export const taskConfirmationStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "CONFIRMED",
  "DECLINED",
  "SUPERSEDED",
]);

export type TaskConfirmationStatus = z.infer<typeof taskConfirmationStatusSchema>;

export const taskConfirmationRowSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type TaskConfirmationRow = z.infer<typeof taskConfirmationRowSchema>;

/** Nest confirmation field input types. Omitted / unknown → text. */
export const confirmationInputTypeSchema = z.enum(["text", "money", "lineItems"]);

export type ConfirmationInputType = z.infer<typeof confirmationInputTypeSchema>;

export const confirmationLineItemSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
});

export type ConfirmationLineItem = z.infer<typeof confirmationLineItemSchema>;

/** Editable line-item row in the form (quantity kept as string for inputs). */
export type ConfirmationLineItemValue = {
  name: string;
  quantity: string;
  unitPrice: string;
};

export type ConfirmationFieldValue = string | ConfirmationLineItemValue[];

export type ConfirmationFormValues = Record<string, ConfirmationFieldValue>;

export type ConfirmationPrefillValue = string | ConfirmationLineItemValue[];

/** One field in Nest's confirmationSchema.fields[] */
export const confirmationSchemaFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional().default(false),
  prefillFrom: z.array(z.string()).optional(),
  inputType: confirmationInputTypeSchema.optional(),
});

export type ConfirmationSchemaField = z.infer<
  typeof confirmationSchemaFieldSchema
>;

/** Task-type confirmation form definition from Nest */
export const confirmationFormSchemaSchema = z.object({
  taskType: z.string().optional(),
  costRequired: z.boolean().optional().default(true),
  fields: z.array(confirmationSchemaFieldSchema).default([]),
});

export type ConfirmationFormSchema = z.infer<
  typeof confirmationFormSchemaSchema
>;

export const taskConfirmationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    taskId: z.union([z.string(), z.number()]).transform(String),
    agentId: z.union([z.string(), z.number()]).transform(String).optional(),
    /** Client user id — do not show this as PII in UI. */
    userId: z.union([z.string(), z.number()]).transform(String).optional(),
    status: taskConfirmationStatusSchema,
    taskType: z.string().optional(),
    confirmationSchema: confirmationFormSchemaSchema.optional(),
    title: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    rows: z.array(taskConfirmationRowSchema).default([]),
    cost: z.union([z.string(), z.number()]).transform(String),
    currency: z.string().optional().default("USD"),
    costLabel: z.string().optional().default("Total"),
    costDisplay: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    createdAt: z.string().optional().default(""),
    updatedAt: z.string().optional().default(""),
    decidedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type TaskConfirmation = z.infer<typeof taskConfirmationSchema>;

/**
 * Body for POST .../confirmation/draft (and legacy one-shot).
 * Always includes cost + currency; schema field keys are sent as top-level props.
 */
export const draftTaskConfirmationBodySchema = z
  .object({
    cost: z.string().trim().min(1).max(40),
    currency: z.string().trim().min(1).max(10),
    notes: z.string().trim().max(5000).optional(),
  })
  .passthrough();

export type DraftTaskConfirmationBody = z.infer<
  typeof draftTaskConfirmationBodySchema
>;

/** @deprecated Prefer draft + send. Same body shape as draft. */
export const sendTaskConfirmationBodySchema = draftTaskConfirmationBodySchema;
export type SendTaskConfirmationBody = DraftTaskConfirmationBody;

const CONFIRM_SEND_STATUSES = new Set([
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_AGENT",
]);

export function canSendTaskConfirmation(status?: string | null): boolean {
  if (!status) return false;
  if (
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "OFFERED" ||
    status === "QUEUED"
  ) {
    return false;
  }
  return CONFIRM_SEND_STATUSES.has(status);
}

/**
 * GET confirmation only when Nest status implies one was already created.
 * Do **not** probe on fresh IN_PROGRESS — Nest returns 404 when none exists.
 * After a decline Nest returns to IN_PROGRESS; the workspace hydrates via
 * session presence + socket instead of a blind GET.
 * DRAFT confirmations are hydrated the same way after create.
 */
export function shouldFetchTaskConfirmation(status?: string | null): boolean {
  return (
    status === "WAITING_FOR_USER" ||
    status === "WAITING_FOR_AGENT" ||
    status === "COMPLETED"
  );
}

export function isConfirmationDraft(
  confirmation?: Pick<TaskConfirmation, "status"> | null,
): boolean {
  return confirmation?.status === "DRAFT";
}

export function isConfirmationPending(
  confirmation?: Pick<TaskConfirmation, "status"> | null,
): boolean {
  return confirmation?.status === "PENDING";
}

export function isConfirmationConfirmed(
  confirmation?: Pick<TaskConfirmation, "status"> | null,
): boolean {
  return confirmation?.status === "CONFIRMED";
}

export function confirmationStatusLabel(status: TaskConfirmationStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft preview";
    case "PENDING":
      return "Waiting for Customer";
    case "CONFIRMED":
      return "Client approved";
    case "DECLINED":
      return "Client declined";
    case "SUPERSEDED":
      return "Replaced by a newer request";
  }
}

export function parseTaskConfirmationPayload(
  payload: unknown,
): TaskConfirmation | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  for (const candidate of [root.data, root.confirmation, payload]) {
    const parsed = taskConfirmationSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export function parseConfirmationFormSchema(
  value: unknown,
): ConfirmationFormSchema | null {
  const parsed = confirmationFormSchemaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function fieldInputType(
  field: Pick<ConfirmationSchemaField, "inputType">,
): ConfirmationInputType {
  return field.inputType ?? "text";
}

function parseLineItemValue(raw: unknown): ConfirmationLineItemValue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const name = row.name == null ? "" : String(row.name).trim();
  const unitPrice =
    row.unitPrice == null ? "" : String(row.unitPrice).trim();
  const quantityRaw = row.quantity;
  const quantity =
    quantityRaw == null || quantityRaw === ""
      ? "1"
      : String(quantityRaw).trim();
  if (!name && !unitPrice) return null;
  return { name, quantity: quantity || "1", unitPrice };
}

export function parseConfirmationPrefill(
  value: unknown,
): Record<string, ConfirmationPrefillValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, ConfirmationPrefillValue> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      const items = raw
        .map(parseLineItemValue)
        .filter((item): item is ConfirmationLineItemValue => item != null);
      if (items.length > 0) out[key] = items;
      continue;
    }
    if (typeof raw === "object") continue;
    const text = String(raw).trim();
    if (text) out[key] = text;
  }
  return out;
}

export function emptyLineItem(): ConfirmationLineItemValue {
  return { name: "", quantity: "1", unitPrice: "" };
}

export function isLineItemsValue(
  value: ConfirmationFieldValue | undefined,
): value is ConfirmationLineItemValue[] {
  return Array.isArray(value);
}

export function asFieldText(
  value: ConfirmationFieldValue | undefined,
): string {
  return typeof value === "string" ? value : "";
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/** Sum of line-item qty × unitPrice, or null if nothing priced. */
export function computeLineItemsSubtotal(
  values: ConfirmationFormValues,
  fieldKey: string,
): string | null {
  const items = isLineItemsValue(values[fieldKey]) ? values[fieldKey] : [];
  let itemsTotal = 0;
  let hasPricedItem = false;
  for (const item of items) {
    const quantity = parseAmount(item.quantity);
    const unitPrice = parseAmount(item.unitPrice);
    if (quantity == null || unitPrice == null) continue;
    itemsTotal += quantity * unitPrice;
    hasPricedItem = true;
  }
  return hasPricedItem ? formatAmount(itemsTotal) : null;
}

/**
 * Suggest total from schema values:
 * - unitPrice × ticketCount / passengers (movie / flight)
 * - lineItems sum (food)
 */
export function computeSuggestedConfirmationCost(
  fields: ConfirmationSchemaField[],
  values: ConfirmationFormValues,
): string | null {
  const textOf = (key: string) => asFieldText(values[key]).trim();

  const lineField = fields.find((field) => fieldInputType(field) === "lineItems");
  if (lineField) {
    const itemsSubtotal = computeLineItemsSubtotal(values, lineField.key);
    if (itemsSubtotal == null) {
      const subtotal = parseAmount(textOf("subtotal"));
      return subtotal != null ? formatAmount(subtotal) : null;
    }
    return itemsSubtotal;
  }

  const unitPrice = parseAmount(textOf("unitPrice"));
  if (unitPrice == null) return null;
  const count =
    parseAmount(textOf("ticketCount")) ??
    parseAmount(textOf("passengers")) ??
    1;
  return formatAmount(unitPrice * count);
}
/**
 * Nest DraftConfirmationDto keys the dashboard may POST.
 * Fees/tax stay off the agent form by product choice.
 */
export const DRAFT_CONFIRMATION_BODY_KEYS = new Set([
  "cost",
  "currency",
  "notes",
  "items",
  "subtotal",
  "unitPrice",
  // FOOD_DELIVERY
  "merchant",
  "deliveryAddress",
  "deliveryCity",
  "deliveryArea",
  "phone",
  // HOTEL_BOOKING
  "hotel",
  "hotelName",
  "property",
  "location",
  "checkInDate",
  "checkInTime",
  "checkOutDate",
  "checkOutTime",
  "guests",
  "membership",
  "membershipBrand",
  "membershipId",
  // RESTAURANT_RESERVATION
  "restaurant",
  "date",
  "time",
  "pickupTime",
  "partySize",
  "party_size",
  // CAB_BOOKING
  "pickup",
  "pickupAddress",
  "pickupArea",
  "pickupCity",
  "destination",
  "destinationAddress",
  "destinationArea",
  "destinationCity",
  "dropoff",
  "dropoffArea",
  "dropoffCity",
  // FLIGHT_BOOKING / MOVIE_NIGHT
  "airline",
  "origin",
  "arrival",
  "departureDate",
  "departureTime",
  "passengers",
  "cabin",
  "cabinClass",
  "ticketCount",
  // MOVIE_NIGHT
  "movie",
  "cinema",
  "ticketType",
]);

/** Schema / metadata aliases Nest maps onto the same hotel meta. */
export const DRAFT_CONFIRMATION_HOTEL_KEYS = new Set([
  "hotel",
  "hotelName",
  "property",
]);

/** @deprecated Legacy drafts only — no longer fold live edits into notes. */
export const DRAFT_CONFIRMATION_NOTES_FIELDS = new Set([
  "membership",
  "merchant",
  "deliveryAddress",
  "deliveryCity",
  "deliveryArea",
  "hotel",
]);

/** Schema fields the agent may edit in the confirmation form. */
export function isDraftConfirmationEditableField(
  field: Pick<ConfirmationSchemaField, "key" | "inputType" | "label">,
): boolean {
  if (field.key === "notes" || field.key === "details") return true;
  if (fieldInputType(field) === "lineItems") return true;
  if (DRAFT_CONFIRMATION_BODY_KEYS.has(field.key)) return true;
  const label = field.label?.trim().toLowerCase();
  if (
    label === "hotel" ||
    label === "membership" ||
    label === "restaurant" ||
    label === "date" ||
    label === "time" ||
    label === "party size" ||
    label === "pickup" ||
    label === "destination" ||
    label === "airline" ||
    label === "origin" ||
    label === "arrival" ||
    label === "departure date" ||
    label === "departure time" ||
    label === "passengers" ||
    label === "cabin class" ||
    label === "cabin" ||
    label === "price per seat" ||
    label === "movie" ||
    label === "cinema" ||
    label === "ticket type" ||
    label === "tickets" ||
    label === "price per ticket"
  ) {
    return true;
  }
  return false;
}

/**
 * Build draft POST body from schema field values.
 * Sends Nest DraftConfirmationDto keys directly (no notes hack).
 */
export function buildConfirmationDraftBody(
  fields: ConfirmationSchemaField[],
  values: ConfirmationFormValues,
  cost: string,
  currency: string,
): DraftTaskConfirmationBody {
  const body: Record<string, unknown> = {
    cost: cost.trim(),
    currency: currency.trim() || "USD",
  };

  for (const field of fields) {
    if (!isDraftConfirmationEditableField(field)) continue;

    const value = values[field.key];
    const inputType = fieldInputType(field);

    if (field.key === "notes" || field.key === "details") {
      const notes = asFieldText(value).trim();
      if (notes) body.notes = notes;
      continue;
    }

    if (inputType === "lineItems") {
      const rows = isLineItemsValue(value) ? value : [];
      const items: ConfirmationLineItem[] = [];
      for (const row of rows) {
        const name = row.name.trim();
        const unitPrice = row.unitPrice.trim();
        const quantity = parseAmount(row.quantity);
        if (!name || !unitPrice || quantity == null) continue;
        const parsed = confirmationLineItemSchema.safeParse({
          name,
          quantity,
          unitPrice,
        });
        if (parsed.success) items.push(parsed.data);
      }
      if (items.length > 0) body.items = items;
      continue;
    }

    const text = asFieldText(value).trim();
    if (!text) continue;

    const label = field.label?.trim().toLowerCase();

    // Hotel aliases → Nest accepts hotel | hotelName | property
    if (DRAFT_CONFIRMATION_HOTEL_KEYS.has(field.key) || label === "hotel") {
      if (field.key === "hotelName" || field.key === "property") {
        body[field.key] = text;
      }
      body.hotel = text;
      continue;
    }

    // Membership: combined string, also split brand/id when "Brand — ID"
    if (field.key === "membership" || label === "membership") {
      body.membership = text;
      const parsed = parseMembershipLine(text);
      if (parsed) {
        body.membershipBrand = parsed.brand;
        body.membershipId = parsed.membershipId;
      }
      continue;
    }

    if (field.key === "membershipBrand" || field.key === "membershipId") {
      body[field.key] = text;
      continue;
    }

    // Restaurant reservation fields
    if (
      field.key === "restaurant" ||
      field.key === "date" ||
      field.key === "time" ||
      field.key === "pickupTime" ||
      field.key === "partySize" ||
      field.key === "party_size" ||
      label === "restaurant" ||
      label === "date" ||
      label === "time" ||
      label === "party size"
    ) {
      if (label === "restaurant" || field.key === "restaurant") {
        body.restaurant = text;
      } else if (label === "date" || field.key === "date") {
        body.date = text;
      } else if (
        label === "time" ||
        field.key === "time" ||
        field.key === "pickupTime"
      ) {
        body.time = text;
        if (field.key === "pickupTime") body.pickupTime = text;
      } else if (
        label === "party size" ||
        field.key === "partySize" ||
        field.key === "party_size"
      ) {
        body.partySize = text;
      }
      continue;
    }

    // Cab booking fields
    if (
      field.key === "pickup" ||
      field.key === "pickupAddress" ||
      label === "pickup"
    ) {
      body.pickup = text;
      if (field.key === "pickupAddress") body.pickupAddress = text;
      continue;
    }
    if (
      field.key === "destination" ||
      field.key === "destinationAddress" ||
      field.key === "dropoff" ||
      label === "destination"
    ) {
      body.destination = text;
      if (field.key === "destinationAddress") body.destinationAddress = text;
      if (field.key === "dropoff") body.dropoff = text;
      continue;
    }
    if (
      field.key === "pickupArea" ||
      field.key === "pickupCity" ||
      field.key === "destinationArea" ||
      field.key === "destinationCity" ||
      field.key === "dropoffArea" ||
      field.key === "dropoffCity"
    ) {
      body[field.key] = text;
      continue;
    }

    // Flight booking fields
    if (field.key === "airline" || label === "airline") {
      body.airline = text;
      continue;
    }
    if (field.key === "origin" || label === "origin") {
      body.origin = text;
      continue;
    }
    if (field.key === "arrival" || label === "arrival") {
      body.arrival = text;
      continue;
    }
    if (field.key === "departureDate" || label === "departure date") {
      body.departureDate = text;
      continue;
    }
    if (field.key === "departureTime" || label === "departure time") {
      body.departureTime = text;
      continue;
    }
    if (field.key === "passengers" || label === "passengers") {
      body.passengers = text;
      continue;
    }
    if (
      field.key === "cabin" ||
      field.key === "cabinClass" ||
      label === "cabin" ||
      label === "cabin class"
    ) {
      body.cabin = text;
      if (field.key === "cabinClass") body.cabinClass = text;
      continue;
    }
    if (
      field.key === "unitPrice" ||
      field.key === "ticketCount" ||
      label === "price per seat" ||
      label === "price per ticket" ||
      label === "tickets"
    ) {
      if (field.key === "ticketCount" || label === "tickets") {
        body.ticketCount = text;
      } else {
        body.unitPrice = text;
      }
      continue;
    }

    // Movie night fields
    if (field.key === "movie" || label === "movie") {
      body.movie = text;
      continue;
    }
    if (field.key === "cinema" || label === "cinema") {
      body.cinema = text;
      continue;
    }
    if (field.key === "ticketType" || label === "ticket type") {
      body.ticketType = text;
      continue;
    }

    if (!DRAFT_CONFIRMATION_BODY_KEYS.has(field.key)) continue;
    body[field.key] = text;
  }

  return draftTaskConfirmationBodySchema.parse(body);
}

/** Parse "Brand — ID" / "Brand - ID" from the combined membership field. */
export function parseMembershipLine(
  value: string,
): { brand: string; membershipId: string } | null {
  const match = value
    .trim()
    .match(/^(.+?)\s*[—–-]\s*(\S.+)$/);
  if (!match) return null;
  const brand = match[1].trim();
  const membershipId = match[2].trim();
  if (!brand || !membershipId) return null;
  return { brand, membershipId };
}

/**
 * @deprecated Prefer buildConfirmationDraftBody — Nest expects structured field keys.
 * Kept for any callers still flattening into notes.
 */
export function buildConfirmationDraftNotes(
  fields: ConfirmationSchemaField[],
  values: Record<string, string> | ConfirmationFormValues,
): string {
  const lines: string[] = [];
  let freeNotes = "";

  for (const field of fields) {
    const raw = values[field.key];
    if (isLineItemsValue(raw)) continue;
    const value = (typeof raw === "string" ? raw : "").trim();
    if (!value) continue;
    if (field.key === "notes" || field.key === "details") {
      freeNotes = value;
      continue;
    }
    lines.push(`${field.label}: ${value}`);
  }

  if (freeNotes) lines.push(freeNotes);
  return lines.join("\n").trim();
}

/** Agent-authored confirmation rows for draft body when Nest accepts `rows`. */
export function buildConfirmationDraftRows(
  fields: ConfirmationSchemaField[],
  values: Record<string, string> | ConfirmationFormValues,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const field of fields) {
    if (field.key === "notes" || field.key === "details") continue;
    const raw = values[field.key];
    if (isLineItemsValue(raw)) {
      const summary = raw
        .filter((item) => item.name.trim())
        .map((item) => {
          const qty = item.quantity.trim() || "1";
          const price = item.unitPrice.trim();
          return price
            ? `${qty}× ${item.name.trim()} @ ${price}`
            : `${qty}× ${item.name.trim()}`;
        })
        .join(", ");
      if (summary) rows.push({ label: field.label, value: summary });
      continue;
    }
    const value = (typeof raw === "string" ? raw : "").trim();
    if (!value) continue;
    rows.push({ label: field.label, value });
  }
  return rows;
}
