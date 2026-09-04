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

  /** Create DRAFT — Nest merges notes + metadata into preview rows. */
  async createDraft(
    taskId: string,
    body: DraftTaskConfirmationBody,
  ): Promise<TaskConfirmation> {
    const input = draftTaskConfirmationBodySchema.parse(body);
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskConfirmationDraft(taskId),
      {
        method: "POST",
        body: {
          cost: input.cost,
          ...(input.notes ? { notes: input.notes } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
        },
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
    const input = draftTaskConfirmationBodySchema.parse(body);
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskConfirmation(taskId),
      {
        method: "POST",
        body: {
          cost: input.cost,
          ...(input.notes ? { notes: input.notes } : {}),
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
