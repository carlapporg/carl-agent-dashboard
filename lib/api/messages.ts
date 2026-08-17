import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { addTimelineEvent, mockTimeline } from "@/mocks/data";
import { timelineEventSchema, type TimelineEvent } from "@/types/message";

export const messagesApi = {
  async list(taskId: string): Promise<TimelineEvent[]> {
    if (!env.isApiConfigured) {
      return mockTimeline
        .filter((e) => e.taskId === taskId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
    }

    return apiRequest(API_ENDPOINTS.messages.list(taskId), {
      schema: z.array(timelineEventSchema),
    });
  },

  async send(
    taskId: string,
    body: string,
    visibleToCustomer = true,
  ): Promise<TimelineEvent> {
    if (!env.isApiConfigured) {
      return addTimelineEvent({
        taskId,
        kind: "agent_message",
        body,
        authorName: "Alex Morgan",
        visibleToCustomer,
      });
    }

    return apiRequest(API_ENDPOINTS.messages.send(taskId), {
      method: "POST",
      body: { body, visibleToCustomer },
      schema: timelineEventSchema,
      dedupe: false,
    });
  },
};
