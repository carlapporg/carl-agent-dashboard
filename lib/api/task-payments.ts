import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  cancelTaskPaymentResultSchema,
  requestTaskPaymentResultSchema,
  virtualCardSecretsSchema,
  type TaskPayment,
  type VirtualCardSecrets,
} from "@/types/task-payment";

function unwrapPayment(data: unknown): TaskPayment {
  if (data && typeof data === "object" && "payment" in data) {
    return requestTaskPaymentResultSchema.parse(data).payment;
  }
  return requestTaskPaymentResultSchema.shape.payment.parse(data);
}

export const taskPaymentsApi = {
  async request(
    taskId: string,
    body: {
      spendAmountCents: number;
      currency?: string;
      confirmationId?: string;
    },
  ): Promise<TaskPayment> {
    const data = await apiRequest(API_ENDPOINTS.agents.taskPayments(taskId), {
      method: "POST",
      body,
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    return unwrapPayment(data);
  },

  async getCard(
    taskId: string,
    paymentId: string,
  ): Promise<VirtualCardSecrets> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskPaymentCard(taskId, paymentId),
      {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    if (data && typeof data === "object" && "data" in data) {
      return virtualCardSecretsSchema.parse(
        (data as { data: unknown }).data,
      );
    }
    return virtualCardSecretsSchema.parse(data);
  },

  async cancel(taskId: string, paymentId: string): Promise<TaskPayment> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskPaymentCancel(taskId, paymentId),
      {
        method: "POST",
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    if (data && typeof data === "object" && "payment" in data) {
      return cancelTaskPaymentResultSchema.parse(data).payment;
    }
    return cancelTaskPaymentResultSchema.shape.payment.parse(data);
  },
};
