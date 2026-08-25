import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import {
  parseTaskConfirmationPayload,
  sendTaskConfirmationBodySchema,
  type SendTaskConfirmationBody,
  type TaskConfirmation,
} from "@/types/confirmation";

export const confirmationApi = {
  /** Latest confirmation on this task. `null` if none has been sent yet. */
  async get(taskId: string): Promise<TaskConfirmation | null> {
    try {
      const data = await apiRequest(
        API_ENDPOINTS.agents.taskConfirmation(taskId),
        {
          method: "GET",
          schema: z.unknown(),
          looseEnvelope: true,
        },
      );
      return parseTaskConfirmationPayload(data);
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },

  /** Send notes + cost to the user. Previous PENDING confirmation becomes SUPERSEDED. */
  async send(
    taskId: string,
    body: SendTaskConfirmationBody,
  ): Promise<TaskConfirmation> {
    const input = sendTaskConfirmationBodySchema.parse(body);
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskConfirmation(taskId),
      {
        method: "POST",
        body: {
          notes: input.notes,
          cost: input.cost,
          ...(input.currency ? { currency: input.currency } : {}),
        },
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    const parsed = parseTaskConfirmationPayload(data);
    if (!parsed) throw new Error("Unable to read this confirmation.");
    return parsed;
  },
};
