import { z } from "zod";
import type { Task } from "@/types/task";

export const venueChoiceSchema = z.enum([
  "AGENT_SUGGEST",
  "AGENT_PICKED",
  "USER_PICKED",
  "USER_CUSTOM",
]);

export type VenueChoice = z.infer<typeof venueChoiceSchema>;

export const venueSuggestionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  priceLevel: z.number().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  types: z.array(z.string()).default([]),
});

export type VenueSuggestion = z.infer<typeof venueSuggestionSchema>;

export const venueRefreshResultSchema = z.object({
  taskId: z.string().optional(),
  query: z.string().optional(),
  suggestions: z.array(venueSuggestionSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type VenueRefreshResult = z.infer<typeof venueRefreshResultSchema>;

const VENUE_SUGGEST_TASK_TYPES = new Set([
  "RESTAURANT_RESERVATION",
  "HOTEL_BOOKING",
  "FOOD_DELIVERY",
  "MOVIE_NIGHT",
  "GENERAL",
]);

const NAME_KEYS = [
  "restaurant",
  "hotel",
  "property",
  "cinema",
  "merchant",
  "venue",
  "place",
] as const;

const ADDRESS_KEYS = [
  "restaurantAddress",
  "hotelAddress",
  "cinemaAddress",
  "merchantAddress",
  "venueAddress",
  "location",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstString(
  meta: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function supportsVenueSuggestions(taskType?: string | null): boolean {
  return Boolean(taskType && VENUE_SUGGEST_TASK_TYPES.has(taskType));
}

export function parseVenueSuggestions(raw: unknown): VenueSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: VenueSuggestion[] = [];
  for (const row of raw) {
    const parsed = venueSuggestionSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function parseVenueChoice(raw: unknown): VenueChoice | null {
  if (
    raw === "AGENT_SUGGEST" ||
    raw === "AGENT_PICKED" ||
    raw === "USER_PICKED" ||
    raw === "USER_CUSTOM"
  ) {
    return raw;
  }
  return null;
}

export type TaskVenueMeta = {
  venueChoice: VenueChoice | null;
  venueSuggestions: VenueSuggestion[];
  venueSearchQuery: string | null;
  pickedName: string | null;
  pickedAddress: string | null;
  pickedMapsUrl: string | null;
  pickedRating: number | null;
  pickedSuggestionId: string | null;
};

export function readTaskVenueMeta(task: Task): TaskVenueMeta {
  const meta = asRecord(task.metadata) ?? {};
  const venueChoice = parseVenueChoice(meta.venueChoice);

  const ratingRaw = meta.pickedSuggestionRating;
  const pickedRating =
    typeof ratingRaw === "number" && Number.isFinite(ratingRaw)
      ? ratingRaw
      : null;

  return {
    venueChoice,
    venueSuggestions: parseVenueSuggestions(meta.venueSuggestions),
    venueSearchQuery:
      typeof meta.venueSearchQuery === "string" ? meta.venueSearchQuery : null,
    pickedName: firstString(meta, NAME_KEYS),
    pickedAddress: firstString(meta, ADDRESS_KEYS),
    pickedMapsUrl:
      typeof meta.pickedSuggestionMapsUrl === "string"
        ? meta.pickedSuggestionMapsUrl
        : null,
    pickedRating,
    pickedSuggestionId:
      typeof meta.pickedSuggestionId === "string"
        ? meta.pickedSuggestionId
        : null,
  };
}

export function isUserLockedVenue(choice: VenueChoice | null): boolean {
  return choice === "USER_PICKED" || choice === "USER_CUSTOM";
}

export function isVenueLocked(choice: VenueChoice | null): boolean {
  return (
    choice === "USER_PICKED" ||
    choice === "USER_CUSTOM" ||
    choice === "AGENT_PICKED"
  );
}

/**
 * Agent never picks from Places — mobile sends one locked venue.
 * Kept for call sites; always false.
 */
export function shouldShowVenuePicker(_task: Task): boolean {
  return false;
}

/** Locked venue card when client (or prior agent draft) locked a place. */
export function shouldShowVenuePickedSummary(task: Task): boolean {
  if (!supportsVenueSuggestions(task.taskType)) return false;
  const { venueChoice, pickedName } = readTaskVenueMeta(task);
  return isVenueLocked(venueChoice) && Boolean(pickedName);
}

/** Client deferred — agent waits for one USER_PICKED / USER_CUSTOM venue. */
export function shouldShowWaitingForClientVenue(task: Task): boolean {
  if (!supportsVenueSuggestions(task.taskType)) return false;
  if (shouldShowVenuePickedSummary(task)) return false;
  const { venueChoice, pickedName } = readTaskVenueMeta(task);
  if (isVenueLocked(venueChoice)) return false;
  return venueChoice === "AGENT_SUGGEST" || (!venueChoice && !pickedName);
}

/** Agent drafts never send suggestionId — venue comes from the client. */
export function shouldSendVenueSuggestionId(_task: Task): boolean {
  return false;
}
