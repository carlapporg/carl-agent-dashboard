import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import {
  draftTaskConfirmationBodySchema,
  parseTaskConfirmationPayload,
  type DraftTaskConfirmationBody,
  type TaskConfirmation,
} from "@/types/confirmation";

function draftRequestBody(body: DraftTaskConfirmationBody): Record<string, unknown> {
  const input = draftTaskConfirmationBodySchema.parse(body);
  const payload: Record<string, unknown> = {
    cost: input.cost,
    currency: input.currency,
  };

  for (const [key, value] of Object.entries(input)) {
    if (key === "cost" || key === "currency") continue;
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    payload[key] = value;
  }

  return payload;
}

export const confirmationApi = {
  /** Latest confirmation on this task. Prefers DRAFT, else latest. `null` if none. */
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

  /** Create DRAFT — Nest merges structured field keys into preview rows. */
  async createDraft(
    taskId: string,
    body: DraftTaskConfirmationBody,
  ): Promise<TaskConfirmation> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskConfirmationDraft(taskId),
      {
        method: "POST",
        body: draftRequestBody(body),
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    const parsed = parseTaskConfirmationPayload(data);
    if (!parsed) throw new Error("Unable to read this confirmation draft.");
    return parsed;
  },

  /** Send an existing DRAFT to the user (DRAFT → PENDING). */
  async sendDraft(
    taskId: string,
    confirmationId: string,
  ): Promise<TaskConfirmation> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskConfirmationSend(taskId, confirmationId),
      {
        method: "POST",
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    const parsed = parseTaskConfirmationPayload(data);
    if (!parsed) throw new Error("Unable to read this confirmation.");
    return parsed;
  },

  /**
   * Legacy one-shot: create draft and send immediately.
   * Prefer createDraft + sendDraft.
   */
  async send(
    taskId: string,
    body: DraftTaskConfirmationBody,
  ): Promise<TaskConfirmation> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskConfirmation(taskId),
      {
        method: "POST",
        body: draftRequestBody(body),
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
