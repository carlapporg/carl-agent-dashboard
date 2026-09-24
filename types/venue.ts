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
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
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

const MAPS_URL_KEYS = [
  "mapsUrl",
  "mapUrl",
  "maps_url",
  "map_url",
  "googleMapsUrl",
  "googleMapsUri",
  "google_maps_url",
  "pickedSuggestionMapsUrl",
  "url",
  "placeUrl",
  "venueUrl",
  "link",
] as const;

/** Pull Nest / Places map link from whatever key the payload used. */
export function extractMapsUrl(raw: unknown): string | null {
  const meta = asRecord(raw);
  if (!meta) return null;
  const direct = firstString(meta, MAPS_URL_KEYS);
  if (direct?.startsWith("http")) return direct;
  const nested =
    asRecord(meta.suggestion) ??
    asRecord(meta.venue) ??
    asRecord(meta.picked) ??
    asRecord(meta.place);
  if (nested) {
    const nestedUrl = firstString(nested, MAPS_URL_KEYS);
    if (nestedUrl?.startsWith("http")) return nestedUrl;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Normalize Nest / socket / chat venue shapes into VenueSuggestion.
 * Captures mapsUrl from common Nest/Places aliases when it arrives.
 */
export function normalizeVenueSuggestion(raw: unknown): VenueSuggestion | null {
  const root = asRecord(raw);
  if (!root) return null;
  const nested =
    asRecord(root.suggestion) ??
    asRecord(root.venue) ??
    asRecord(root.picked) ??
    asRecord(root.place);
  const meta = nested ?? root;

  const name = firstString(meta, [
    "name",
    "venueName",
    "hotel",
    "restaurant",
    "venue",
    "title",
  ]);
  if (!name) return null;

  const id =
    firstString(meta, ["id", "suggestionId", "placeId", "venuePlaceId"]) ??
    `venue-${name}`;

  const address = firstString(meta, [
    "address",
    "venueAddress",
    "hotelAddress",
    "restaurantAddress",
    "formattedAddress",
    "formatted_address",
  ]);

  const mapsUrl = extractMapsUrl(meta) ?? extractMapsUrl(root);
  const lat =
    asNumber(meta.lat) ??
    asNumber(meta.latitude) ??
    asNumber(meta.venueLat);
  const lng =
    asNumber(meta.lng) ??
    asNumber(meta.longitude) ??
    asNumber(meta.venueLng);

  const candidate: VenueSuggestion = {
    id,
    name,
    address,
    rating: asNumber(meta.rating ?? meta.pickedSuggestionRating),
    priceLevel: asNumber(meta.priceLevel ?? meta.price_level),
    mapsUrl,
    types: Array.isArray(meta.types)
      ? meta.types.filter((t): t is string => typeof t === "string")
      : [],
    lat,
    lng,
  };

  return candidate;
}

export function supportsVenueSuggestions(taskType?: string | null): boolean {
  return Boolean(taskType && VENUE_SUGGEST_TASK_TYPES.has(taskType));
}

export function parseVenueSuggestions(raw: unknown): VenueSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: VenueSuggestion[] = [];
  for (const row of raw) {
    const normalized = normalizeVenueSuggestion(row);
    if (normalized) out.push(normalized);
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
  pickedLat: number | null;
  pickedLng: number | null;
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
      extractMapsUrl(meta) ??
      (typeof meta.pickedSuggestionMapsUrl === "string"
        ? meta.pickedSuggestionMapsUrl
        : null),
    pickedRating,
    pickedSuggestionId:
      typeof meta.pickedSuggestionId === "string"
        ? meta.pickedSuggestionId
        : null,
    pickedLat:
      asNumber(meta.venueLat) ?? asNumber(meta.lat) ?? asNumber(meta.latitude),
    pickedLng:
      asNumber(meta.venueLng) ??
      asNumber(meta.lng) ??
      asNumber(meta.longitude),
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

function taskHasStarted(task: Task): boolean {
  const backend = task.backendStatus;
  return (
    backend === "IN_PROGRESS" ||
    backend === "WAITING_FOR_USER" ||
    backend === "WAITING_FOR_AGENT" ||
    task.status === "in_progress" ||
    task.status === "waiting_for_customer" ||
    task.status === "waiting_for_payment"
  );
}

/** After Start — wait until customer picks a place. */
export function shouldShowWaitingForClientVenue(task: Task): boolean {
  if (!supportsVenueSuggestions(task.taskType)) return false;
  if (!taskHasStarted(task)) return false;
  if (shouldShowVenuePickedSummary(task)) return false;
  const { venueChoice, pickedName } = readTaskVenueMeta(task);
  if (isVenueLocked(venueChoice)) return false;
  return venueChoice === "AGENT_SUGGEST" || (!venueChoice && !pickedName);
}

/** Agent drafts never send suggestionId — venue comes from the client. */
export function shouldSendVenueSuggestionId(_task: Task): boolean {
  return false;
}

export function parseVenueSuggestion(raw: unknown): VenueSuggestion | null {
  return normalizeVenueSuggestion(raw);
}

export function parseVenueSuggestionsPayload(payload: unknown): {
  taskId: string;
  suggestions: VenueSuggestion[];
  message: string | null;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const taskId =
    typeof data.taskId === "string"
      ? data.taskId
      : typeof root.taskId === "string"
        ? root.taskId
        : null;
  if (!taskId) return null;
  const suggestions = parseVenueSuggestions(
    data.suggestions ?? data.venueSuggestions,
  );
  const message =
    typeof data.message === "string"
      ? data.message
      : typeof root.message === "string"
        ? root.message
        : null;
  return { taskId, suggestions, message };
}

export function parseVenuePickedPayload(payload: unknown): {
  taskId: string;
  suggestion: VenueSuggestion | null;
  message: string | null;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const taskId =
    typeof data.taskId === "string"
      ? data.taskId
      : typeof root.taskId === "string"
        ? root.taskId
        : null;
  if (!taskId) return null;
  const suggestion =
    parseVenueSuggestion(data.suggestion) ??
    parseVenueSuggestion(data.venue) ??
    parseVenueSuggestion(data.picked) ??
    parseVenueSuggestion(data) ??
    null;
  const message =
    typeof data.message === "string"
      ? data.message
      : typeof root.message === "string"
        ? root.message
        : null;
  return { taskId, suggestion, message };
}

/** From chat message `metadata.kind === 'venue_picked'`. */
export function venueFromMessageMetadata(
  metadata: unknown,
): VenueSuggestion | null {
  const meta = asRecord(metadata);
  if (!meta) return null;
  const kind = String(meta.kind ?? meta.type ?? "").toLowerCase();
  if (kind && kind !== "venue_picked" && kind !== "venuepicked") {
    return null;
  }
  return (
    normalizeVenueSuggestion(meta.suggestion) ??
    normalizeVenueSuggestion(meta.venue) ??
    normalizeVenueSuggestion(meta.picked) ??
    normalizeVenueSuggestion(meta)
  );
}

/** Maps link from Nest, or a Google Maps search fallback for USER_CUSTOM. */
export function mapsUrlForVenue(input: {
  mapsUrl?: string | null;
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string | null {
  if (input.mapsUrl?.trim()) return input.mapsUrl.trim();
  if (
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${input.lat},${input.lng}`;
  }
  const query = [input.name, input.address]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isVenuePickedMessageMetadata(metadata: unknown): boolean {
  const meta = asRecord(metadata);
  if (!meta) return false;
  const kind = String(meta.kind ?? meta.type ?? "").toLowerCase();
  return kind === "venue_picked" || kind === "venuepicked";
}

/** Merge a customer pick into task.metadata (never clears USER_PICKED). */
export function taskMetadataWithVenuePick(
  current: Record<string, unknown> | null | undefined,
  suggestion: VenueSuggestion,
): Record<string, unknown> {
  const prev = current && typeof current === "object" ? { ...current } : {};
  if (prev.venueChoice === "USER_PICKED" || prev.venueChoice === "USER_CUSTOM") {
    // Keep locked choice; still refresh display fields if empty.
  } else {
    prev.venueChoice = "USER_PICKED";
  }
  prev.pickedSuggestionId = suggestion.id;
  const maps = mapsUrlForVenue(suggestion);
  if (maps) {
    prev.pickedSuggestionMapsUrl = maps;
    prev.mapsUrl = maps;
  }
  if (suggestion.rating != null) prev.pickedSuggestionRating = suggestion.rating;
  if (!prev.restaurant) prev.restaurant = suggestion.name;
  if (!prev.hotel) prev.hotel = suggestion.name;
  if (!prev.venue) prev.venue = suggestion.name;
  if (suggestion.address) {
    if (!prev.restaurantAddress) prev.restaurantAddress = suggestion.address;
    if (!prev.hotelAddress) prev.hotelAddress = suggestion.address;
    if (!prev.venueAddress) prev.venueAddress = suggestion.address;
  }
  if (suggestion.lat != null) prev.venueLat = suggestion.lat;
  if (suggestion.lng != null) prev.venueLng = suggestion.lng;
  return prev;
}
