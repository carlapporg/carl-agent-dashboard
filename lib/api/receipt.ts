import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import {
  parseTaskReceiptPayload,
  type TaskReceipt,
} from "@/types/receipt";

export const receiptApi = {
  /** Latest receipt on this task. `null` if none has been sent yet. */
  async get(taskId: string): Promise<TaskReceipt | null> {
    try {
      const data = await apiRequest(API_ENDPOINTS.agents.taskReceipt(taskId), {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      });
      return parseTaskReceiptPayload(data);
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },

  async getById(taskId: string, receiptId: string): Promise<TaskReceipt | null> {
    try {
      const data = await apiRequest(
        API_ENDPOINTS.agents.taskReceiptById(taskId, receiptId),
        {
          method: "GET",
          schema: z.unknown(),
          looseEnvelope: true,
        },
      );
      return parseTaskReceiptPayload(data);
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },

  /**
   * Upload one receipt/document. Previous active receipt becomes SUPERSEDED.
   * Client approval is not required; agent may complete after upload.
   */
  async upload(
    taskId: string,
    file: File,
    note?: string,
  ): Promise<TaskReceipt> {
    const form = new FormData();
    form.set("file", file);
    const trimmed = note?.trim();
    if (trimmed) form.set("note", trimmed.slice(0, 2000));
    const data = await apiRequest(API_ENDPOINTS.agents.taskReceipt(taskId), {
      method: "POST",
      body: form,
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
      timeoutMs: 90_000,
    });
    const parsed = parseTaskReceiptPayload(data);
    if (!parsed) throw new Error("Unable to read this receipt.");
    return parsed;
  },
};
