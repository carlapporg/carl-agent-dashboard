import type { TimelineEvent } from "@/types/message";

/** Customer messages the agent has not opened yet. */
export function countUnreadCustomerMessages(events: TimelineEvent[]): number {
  return events.filter(
    (event) =>
      event.kind === "customer_message" && !event.readAt && !event.seenAt,
  ).length;
}

export function markCustomerMessagesRead(
  events: TimelineEvent[],
  readAt: string,
): { events: TimelineEvent[]; changed: boolean } {
  let changed = false;
  const next = events.map((event) => {
    if (event.kind !== "customer_message" || event.readAt || event.seenAt) {
      return event;
    }
    changed = true;
    return { ...event, readAt, seenAt: event.seenAt ?? readAt };
  });
  return { events: next, changed };
}
