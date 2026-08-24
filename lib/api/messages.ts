import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { mapAgentMessageToTimeline } from "@/lib/api/map-task";
import {
  agentTaskMessageListSchema,
  agentTaskMessageSchema,
} from "@/types/agent";
import type { TimelineEvent } from "@/types/message";

export const messagesApi = {
  async list(taskId: string): Promise<TimelineEvent[]> {
    const rows = await apiRequest(API_ENDPOINTS.agents.taskMessages(taskId), {
      method: "GET",
      schema: agentTaskMessageListSchema,
    });
    return rows
      .map(mapAgentMessageToTimeline)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  },

  async send(taskId: string, content: string): Promise<TimelineEvent> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskMessages(taskId), {
      method: "POST",
      body: { content },
      schema: agentTaskMessageSchema,
      dedupe: false,
    });
    return mapAgentMessageToTimeline(row);
  },
};
