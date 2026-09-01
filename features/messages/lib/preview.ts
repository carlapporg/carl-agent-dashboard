import type { TimelineEvent } from "@/types/message";

const CHAT_KINDS = new Set<TimelineEvent["kind"]>([
  "agent_message",
  "customer_message",
]);

/** Latest chat line for conversation list previews. */
export function lastChatPreview(events: TimelineEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!CHAT_KINDS.has(event.kind)) continue;
    if (event.mediaKind === "voice") return "Voice message";
    if (event.mediaKind === "image") {
      return event.body.trim() || "Photo";
    }
    const body = event.body.trim();
    if (body) return body;
  }
  return null;
}

export function lastChatActivityAt(events: TimelineEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (CHAT_KINDS.has(event.kind)) return event.createdAt;
  }
  return null;
}
