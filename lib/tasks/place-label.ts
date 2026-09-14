import type { Task } from "@/types/task";

/**
 * Place / venue for queue + chat lists.
 * Prefers airline, cinema, restaurant, hotel, etc. over customer name.
 */
export function taskPlaceLabel(task: Task): string {
  const meta =
    task.metadata && typeof task.metadata === "object"
      ? (task.metadata as Record<string, unknown>)
      : null;
  const prefill =
    task.confirmationPrefill && typeof task.confirmationPrefill === "object"
      ? (task.confirmationPrefill as Record<string, unknown>)
      : null;
  const candidates = [
    meta?.airline,
    prefill?.airline,
    meta?.cinema,
    prefill?.cinema,
    meta?.theater,
    meta?.theatre,
    meta?.movieTheater,
    prefill?.theater,
    prefill?.theatre,
    meta?.venue,
    prefill?.venue,
    meta?.restaurant,
    prefill?.restaurant,
    meta?.merchant,
    prefill?.merchant,
    meta?.storeName,
    meta?.store,
    meta?.hotel,
    prefill?.hotel,
    meta?.property,
    prefill?.property,
    meta?.location,
    meta?.destinationCity,
    meta?.pickupCity,
    meta?.deliveryCity,
    meta?.city,
    meta?.place,
    meta?.address,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "—";
}

/** Sidebar line when there are no chat messages yet. */
export function taskListSubtitle(task: Task, fallbackTitle: string): string {
  const place = taskPlaceLabel(task);
  if (place !== "—") return place;
  const title = task.title?.trim() || fallbackTitle.trim();
  return title || "—";
}
