import { addTimelineEvent, mockTimeline } from "@/mocks/data";
import type { TimelineEvent } from "@/types/message";

/** Timeline/message APIs are not live yet — always mock. */
export const messagesApi = {
  async list(taskId: string): Promise<TimelineEvent[]> {
    return mockTimeline
      .filter((e) => e.taskId === taskId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  },

  async send(
    taskId: string,
    body: string,
    visibleToCustomer = true,
  ): Promise<TimelineEvent> {
    return addTimelineEvent({
      taskId,
      kind: "agent_message",
      body,
      visibleToCustomer,
    });
  },
};
