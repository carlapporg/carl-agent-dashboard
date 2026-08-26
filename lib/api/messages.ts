import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { mapAgentMessageToTimeline } from "@/lib/api/map-task";
import { agentTaskMessageSchema } from "@/types/agent";
import type { TimelineEvent } from "@/types/message";

const sendResultSchema = z.union([
  agentTaskMessageSchema,
  z.object({ message: z.string() }),
  z.null(),
]);

function extractMessageRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.messages)) return record.messages;
  if (Array.isArray(record.data)) return record.data;
  if (record.id != null) return [record];
  return [];
}

function toTimeline(row: unknown, fallbackTaskId: string): TimelineEvent | null {
  const parsed = agentTaskMessageSchema.safeParse(row);
  if (!parsed.success) return null;
  const event = mapAgentMessageToTimeline(parsed.data);
  return {
    ...event,
    taskId: event.taskId || fallbackTaskId,
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

export const messagesApi = {
  async list(taskId: string): Promise<TimelineEvent[]> {
    const data = await apiRequest(API_ENDPOINTS.agents.taskMessages(taskId), {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    return extractMessageRows(data)
      .map((row) => toTimeline(row, taskId))
      .filter((row): row is TimelineEvent => row != null)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  },

  async send(taskId: string, content: string): Promise<TimelineEvent> {
    const text = content.trim();
    const row = await apiRequest(API_ENDPOINTS.agents.taskMessages(taskId), {
      method: "POST",
      body: { content: text },
      schema: sendResultSchema,
      looseEnvelope: true,
      dedupe: false,
    });
    const event = toTimeline(row, taskId);
    return (
      event ?? {
        id: `local-${Date.now()}`,
        taskId,
        kind: "agent_message",
        body: text,
        createdAt: new Date().toISOString(),
        visibleToCustomer: true,
        mediaKind: "text",
      }
    );
  },

  async sendVoice(taskId: string, form: FormData): Promise<TimelineEvent> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskMessageVoice(taskId), {
      method: "POST",
      body: form,
      schema: sendResultSchema,
      looseEnvelope: true,
      dedupe: false,
      timeoutMs: 90_000,
    });
    const event = toTimeline(row, taskId);
    const durationRaw = form.get("durationMs");
    const durationMs =
      typeof durationRaw === "string" ? Number(durationRaw) : undefined;
    return (
      event ?? {
        id: `local-${Date.now()}`,
        taskId,
        kind: "agent_message",
        body: "",
        createdAt: new Date().toISOString(),
        visibleToCustomer: true,
        mediaKind: "voice",
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
      }
    );
  },

  async sendImage(taskId: string, form: FormData): Promise<TimelineEvent> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskMessageImage(taskId), {
      method: "POST",
      body: form,
      schema: sendResultSchema,
      looseEnvelope: true,
      dedupe: false,
      timeoutMs: 90_000,
    });
    const event = toTimeline(row, taskId);
    const captionRaw = form.get("caption");
    const caption = typeof captionRaw === "string" ? captionRaw : "";
    return (
      event ?? {
        id: `local-${Date.now()}`,
        taskId,
        kind: "agent_message",
        body: caption,
        createdAt: new Date().toISOString(),
        visibleToCustomer: true,
        mediaKind: "image",
      }
    );
  },
};
