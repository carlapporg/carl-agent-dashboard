import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import {
  addTimelineEvent,
  mockCards,
  mockPayments,
  mockReceipts,
  updateTask,
} from "@/mocks/data";
import {
  paymentAuthorizationSchema,
  receiptSchema,
  virtualCardSummarySchema,
  type PaymentAuthorization,
  type Receipt,
  type VirtualCardSummary,
} from "@/types/payment";

export const paymentsApi = {
  async list(taskId: string): Promise<PaymentAuthorization[]> {
    if (!env.isApiConfigured) {
      return mockPayments.filter((p) => p.taskId === taskId);
    }

    return apiRequest(API_ENDPOINTS.payments.list(taskId), {
      schema: z.array(paymentAuthorizationSchema),
    });
  },

  async requestApproval(
    taskId: string,
    input: { amount: number; merchant: string; merchantCategory?: string },
  ): Promise<PaymentAuthorization> {
    if (!env.isApiConfigured) {
      const auth: PaymentAuthorization = {
        id: `pay_${Date.now()}`,
        taskId,
        amount: input.amount,
        remaining: input.amount,
        currency: "USD",
        merchant: input.merchant,
        merchantCategory: input.merchantCategory,
        status: "pending",
        approvedBy: null,
        approvedAt: null,
        requestedAt: new Date().toISOString(),
      };
      mockPayments.push(auth);
      updateTask(taskId, { status: "waiting_for_payment" });
      addTimelineEvent({
        taskId,
        kind: "approval_requested",
        body: `Payment approval requested: $${input.amount.toFixed(0)} for ${input.merchant}`,
        visibleToCustomer: true,
      });
      return auth;
    }

    return apiRequest(API_ENDPOINTS.payments.requestApproval(taskId), {
      method: "POST",
      body: input,
      schema: paymentAuthorizationSchema,
      dedupe: false,
    });
  },

  async getCard(taskId: string): Promise<VirtualCardSummary | null> {
    if (!env.isApiConfigured) {
      return mockCards.find((c) => c.taskId === taskId) ?? null;
    }

    return apiRequest(API_ENDPOINTS.payments.card(taskId), {
      schema: virtualCardSummarySchema.nullable(),
    });
  },

  async markPaid(taskId: string, amount: number): Promise<PaymentAuthorization> {
    if (!env.isApiConfigured) {
      const auth = mockPayments.find(
        (p) => p.taskId === taskId && p.status === "approved",
      );
      if (!auth) throw new Error("NOT_FOUND");
      if (amount > auth.remaining) {
        throw new Error("Amount exceeds remaining approved limit");
      }
      auth.remaining = Math.max(0, auth.remaining - amount);
      if (auth.remaining === 0) auth.status = "spent";
      const card = mockCards.find((c) => c.taskId === taskId);
      if (card) card.remaining = auth.remaining;
      addTimelineEvent({
        taskId,
        kind: "system",
        body: `Merchant charge recorded: $${amount.toFixed(0)}. Remaining $${auth.remaining.toFixed(0)}.`,
      });
      return auth;
    }

    return apiRequest(API_ENDPOINTS.payments.markPaid(taskId), {
      method: "POST",
      body: { amount },
      schema: paymentAuthorizationSchema,
      dedupe: false,
    });
  },
};

export const receiptsApi = {
  async list(taskId: string): Promise<Receipt[]> {
    if (!env.isApiConfigured) {
      return mockReceipts.filter((r) => r.taskId === taskId);
    }

    return apiRequest(API_ENDPOINTS.receipts.list(taskId), {
      schema: z.array(receiptSchema),
    });
  },

  async upload(
    taskId: string,
    input: { fileName: string; amount?: number; merchant?: string },
  ): Promise<Receipt> {
    if (!env.isApiConfigured) {
      const receipt: Receipt = {
        id: `rcpt_${Date.now()}`,
        taskId,
        fileName: input.fileName,
        amount: input.amount ?? null,
        merchant: input.merchant,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "Alex Morgan",
      };
      mockReceipts.push(receipt);
      addTimelineEvent({
        taskId,
        kind: "receipt_uploaded",
        body: `Receipt uploaded: ${input.fileName}`,
        authorName: "Alex Morgan",
        visibleToCustomer: true,
      });
      return receipt;
    }

    return apiRequest(API_ENDPOINTS.receipts.upload(taskId), {
      method: "POST",
      body: input,
      schema: receiptSchema,
      dedupe: false,
    });
  },
};
