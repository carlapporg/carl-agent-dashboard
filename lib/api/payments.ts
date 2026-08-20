import {
  addTimelineEvent,
  mockCards,
  mockPayments,
  mockReceipts,
  updateTask,
} from "@/mocks/data";
import type {
  PaymentAuthorization,
  Receipt,
  VirtualCardSummary,
} from "@/types/payment";

/** Payment APIs are not live yet — always mock. */
export const paymentsApi = {
  async list(taskId: string): Promise<PaymentAuthorization[]> {
    return mockPayments.filter((p) => p.taskId === taskId);
  },

  async requestApproval(
    taskId: string,
    input: {
      amount: number;
      merchant: string;
      merchantCategory?: string;
      description?: string;
    },
  ): Promise<PaymentAuthorization> {
    const auth: PaymentAuthorization = {
      id: `pay_${Date.now()}`,
      taskId,
      amount: input.amount,
      remaining: input.amount,
      currency: "USD",
      merchant: input.merchant,
      merchantCategory: input.merchantCategory,
      description: input.description,
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
      body: "The agent has requested payment approval before continuing this task.",
      visibleToCustomer: true,
    });
    return auth;
  },

  async getCard(taskId: string): Promise<VirtualCardSummary | null> {
    return mockCards.find((c) => c.taskId === taskId) ?? null;
  },

  async markPaid(taskId: string, amount: number): Promise<PaymentAuthorization> {
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
  },
};

export const receiptsApi = {
  async list(taskId: string): Promise<Receipt[]> {
    return mockReceipts.filter((r) => r.taskId === taskId);
  },

  async upload(
    taskId: string,
    input: {
      fileName: string;
      amount?: number;
      merchant?: string;
      authorizationId?: string;
    },
  ): Promise<Receipt> {
    const receipt: Receipt = {
      id: `rcpt_${Date.now()}`,
      taskId,
      fileName: input.fileName,
      amount: input.amount ?? null,
      merchant: input.merchant,
      authorizationId: input.authorizationId,
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
  },
};
