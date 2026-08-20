import {
  findTask,
  mockItineraries,
  mockTasks,
  updateTask,
} from "@/mocks/data";
import type { Itinerary } from "@/types/itinerary";

/** Itinerary APIs are not live yet — always mock. */
export const itineraryApi = {
  async get(parentTaskId: string): Promise<Itinerary | null> {
    return mockItineraries[parentTaskId] ?? null;
  },

  async generate(parentTaskId: string): Promise<Itinerary> {
    const parent = findTask(parentTaskId);
    if (!parent) throw new Error("NOT_FOUND");
    const children = mockTasks.filter((t) => t.parentId === parentTaskId);
    if (children.length === 0) {
      throw new Error("No subtasks to build an itinerary from");
    }
    const incomplete = children.filter((c) => c.status !== "completed");
    if (incomplete.length > 0) {
      throw new Error("Complete all subtasks before generating itinerary");
    }

    const itinerary: Itinerary = {
      id: `itin_${parentTaskId}`,
      parentTaskId,
      title: parent.title,
      generatedAt: new Date().toISOString(),
      items: children.map((c) => ({
        id: `itin_item_${c.id}`,
        taskId: c.id,
        label: c.title,
        detail: c.request,
        status: "confirmed" as const,
      })),
    };
    mockItineraries[parentTaskId] = itinerary;
    return itinerary;
  },

  async confirm(parentTaskId: string): Promise<Itinerary> {
    const itinerary = mockItineraries[parentTaskId];
    if (!itinerary) throw new Error("NOT_FOUND");
    itinerary.agentConfirmedAt = new Date().toISOString();
    return itinerary;
  },

  async send(parentTaskId: string): Promise<Itinerary> {
    const itinerary = mockItineraries[parentTaskId];
    if (!itinerary) throw new Error("NOT_FOUND");
    if (!itinerary.agentConfirmedAt) {
      throw new Error("Confirm itinerary before sending");
    }
    itinerary.sentAt = new Date().toISOString();
    updateTask(parentTaskId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    return itinerary;
  },
};
