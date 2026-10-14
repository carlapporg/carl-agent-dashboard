import type { Task } from "@/types/task";

export type TaskFact = {
  key: string;
  label: string;
  value: string;
};

const KEY_LABELS: Record<string, string> = {
  pickup: "Pickup address",
  pickupAddress: "Pickup address",
  pickupArea: "Pickup area",
  pickupCity: "Pickup city",
  destination: "Destination address",
  destinationAddress: "Destination address",
  destinationArea: "Destination area",
  destinationCity: "Destination city",
  dropoff: "Destination address",
  dropoffArea: "Destination area",
  dropoffCity: "Destination city",
  time: "Pickup time",
  pickupTime: "Pickup time",
  date: "Date",
  start: "Date and time",
  end: "End",
  guests: "Guests",
  hotel: "Hotel",
  restaurant: "Restaurant",
  membership: "Membership",
  membershipBrand: "Membership brand",
  membershipId: "Membership ID",
};

/** Headcounts — never show a trailing % (not a rate). */
const COUNT_KEYS = new Set([
  "guests",
  "guest",
  "guestcount",
  "guestCount",
  "partySize",
  "party_size",
  "ticketCount",
  "passengers",
]);

function isCountKey(key: string): boolean {
  if (COUNT_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return (
    lower === "guests" ||
    lower.endsWith("guests") ||
    lower.includes("guestcount") ||
    lower === "partysize" ||
    lower === "ticketcount" ||
    lower === "passengers"
  );
}

/** Strip accidental % from guest/party counts (e.g. "2%" → "2"). */
export function formatCountValue(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/%/g, "")
    .trim();
}

const SKIP_METADATA_KEYS = new Set([
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
  // Venue pipeline internals — agent sees locked venue card, not these.
  "venueChoice",
  "venueSearchQuery",
  "venueSearchWhat",
  "venueSearchWhere",
  "venueSuggestions",
  "pickedSuggestionId",
  "pickedSuggestionMapsUrl",
  "pickedSuggestionRating",
  "venuePlaceId",
  "venueLat",
  "venueLng",
  "registrationRequired",
]);

const CITY_TIME_ZONES: Record<string, string> = {
  tulsa: "America/Chicago",
  dallas: "America/Chicago",
  houston: "America/Chicago",
  austin: "America/Chicago",
  "san antonio": "America/Chicago",
  "oklahoma city": "America/Chicago",
  "new york": "America/New_York",
  "new york city": "America/New_York",
  "los angeles": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
};

function eventDisplayTimeZone(timeZone: string, city: string): string {
  const zone = timeZone.trim();
  if (zone && zone.toUpperCase() !== "UTC" && zone !== "Etc/UTC") return zone;
  return CITY_TIME_ZONES[city.trim().toLowerCase()] || zone || "UTC";
}

/** Show an event timestamp in the venue clock, not as 2026-10-16T01:00:00Z. */
export function formatEventInstant(
  value: string,
  timeZone: string,
  city = "",
): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const zone = eventDisplayTimeZone(timeZone, city);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: zone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

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
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return titleCase(spaced);
}

function typePrefix(taskType?: string): string {
  const type = (taskType ?? "TASK").toUpperCase();
  const letters = type.replace(/[^A-Z]/g, "");
  return letters.slice(0, 3) || "TSK";
}

function typeLabel(taskType?: string): string {
  if (!taskType) return "Task";
  return titleCase(taskType.replaceAll("_", " ").toLowerCase());
}

export function taskDisplayCode(task: Task): string {
  if (task.code) return task.code;
  const created = new Date(task.createdAt);
  const stamp = Number.isNaN(created.getTime())
    ? "000000"
    : created.toISOString().slice(2, 10).replaceAll("-", "");
  const seq = task.id.replaceAll("-", "").slice(-4).toUpperCase();
  return `${typePrefix(task.taskType)}-${stamp}-${seq}`;
}

export function taskDisplayTitle(task: Task): string {
  const facts = taskFacts(task);
  const pickup =
    facts.find((f) => f.key === "pickup" || f.key === "pickupAddress")?.value;
  const destination =
    facts.find(
      (f) =>
        f.key === "destination" ||
        f.key === "destinationAddress" ||
        f.key === "dropoff",
    )?.value;
  const kind = typeLabel(task.taskType);
  if (pickup && destination) return `${kind}: ${pickup} → ${destination}`;
  if (pickup) return `${kind}: ${pickup}`;
  return task.title;
}

export function taskFacts(task: Task): TaskFact[] {
  const facts: TaskFact[] = [];
  const seen = new Set<string>();
  const metadata = task.metadata;
  const zone =
    metadata && typeof metadata.timezone === "string" ? metadata.timezone : "";
  const city =
    metadata && typeof metadata.city === "string" ? metadata.city : "";

  function add(key: string, raw: unknown, options?: { titleCaseValue?: boolean }) {
    if (raw == null) return;
    const asCount = isCountKey(key);
    const isInstant = key === "start" || key === "end";
    const value = asCount
      ? formatCountValue(raw)
      : isInstant
        ? formatEventInstant(String(raw).trim(), zone, city)
        : String(raw).trim();
    if (!value || seen.has(key)) return;
    seen.add(key);
    facts.push({
      key,
      label: humanizeKey(key),
      value:
        asCount || isInstant || options?.titleCaseValue === false
          ? value
          : titleCase(value),
    });
  }

  // Top-level membership only (user consented). Format matches Nest confirmation rows.
  const membership = task.membership;
  if (membership?.brand?.trim() && membership.membershipId?.trim()) {
    add(
      "membership",
      `${membership.brand.trim()} — ${membership.membershipId.trim()}`,
      { titleCaseValue: false },
    );
  }

  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (SKIP_METADATA_KEYS.has(key)) continue;
      const lower = key.toLowerCase();
      if (lower.startsWith("venue") || lower.startsWith("pickedsuggestion")) {
        continue;
      }
      if (typeof value === "object" && value != null) continue;
      add(key, value);
    }
  }

  const blob = task.request ?? "";
  if (facts.length === 0 && blob.includes(":")) {
    const parts = blob.split("·").map((part) => part.trim());
    for (const part of parts) {
      const index = part.indexOf(":");
      if (index <= 0) continue;
      add(part.slice(0, index).trim(), part.slice(index + 1));
    }
  }

  return facts;
}

export type GeneratedStep = {
  id: string;
  label: string;
  message: string;
};

export function generatedSteps(task: Task): GeneratedStep[] {
  const facts = taskFacts(task);
  const has = (key: string) => facts.some((f) => f.key === key);
  const steps: GeneratedStep[] = [
    {
      id: "review",
      label: "Review task details",
      message: "Step completed: task details reviewed.",
    },
  ];

  if (has("pickup") || has("pickupAddress") || has("pickupArea")) {
    steps.push({
      id: "pickup",
      label: "Verify pickup location",
      message: "Step completed: pickup location verified.",
    });
  }
  if (has("destination") || has("destinationAddress") || has("dropoff")) {
    steps.push({
      id: "destination",
      label: "Verify destination",
      message: "Step completed: destination verified.",
    });
  }
  if (has("hotel")) {
    steps.push({
      id: "hotel",
      label: "Confirm hotel details",
      message: "Step completed: hotel details confirmed.",
    });
  }
  if (has("restaurant")) {
    steps.push({
      id: "restaurant",
      label: "Confirm restaurant details",
      message: "Step completed: restaurant details confirmed.",
    });
  }

  steps.push({
    id: "confirm",
    label: "Confirm with client",
    message: "Step completed: details confirmed with the client.",
  });

  return steps;
}
