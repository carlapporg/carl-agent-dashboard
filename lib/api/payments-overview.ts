import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { dashboardApi } from "@/lib/api/dashboard";

void API_ENDPOINTS;

export type PaymentSummaryMetric = {
  id: string;
  label: string;
  amount: number;
  currency: string;
  deltaPercent: number | null;
};

export type PaymentTxnStatus = "completed" | "pending" | "refunded";

export type PaymentTransactionRow = {
  id: string;
  txnId: string;
  taskId: string | null;
  customer: string;
  amount: number;
  currency: string;
  method: string;
  status: PaymentTxnStatus;
  at: string;
};

function stubSummary(): PaymentSummaryMetric[] {
  return [
    {
      id: "revenue",
      label: "Total revenue",
      amount: 48920,
      currency: "USD",
      deltaPercent: 14.2,
    },
    {
      id: "pending",
      label: "Pending payouts",
      amount: 18920,
      currency: "USD",
      deltaPercent: -4.1,
    },
    {
      id: "refunds",
      label: "Refund triggered",
      amount: 48920,
      currency: "USD",
      deltaPercent: -12.3,
    },
    {
      id: "escrows",
      label: "Completed escrows",
      amount: 48920,
      currency: "USD",
      deltaPercent: 14.2,
    },
  ];
}

function stubTransactions(): PaymentTransactionRow[] {
  const now = Date.now();
  return [
    {
      id: "txn_90210",
      txnId: "TXN-90210",
      taskId: null,
      customer: "Ava Chen",
      amount: 350,
      currency: "USD",
      method: "Credit Card (Visa)",
      status: "completed",
      at: new Date(now - 30 * 60_000).toISOString(),
    },
    {
      id: "txn_90209",
      txnId: "TXN-90209",
      taskId: null,
      customer: "Marcus Vance",
      amount: 120,
      currency: "USD",
      method: "Apple Pay",
      status: "completed",
      at: new Date(now - 90 * 60_000).toISOString(),
    },
    {
      id: "txn_90208",
      txnId: "TXN-90208",
      taskId: null,
      customer: "Sofia Rodriguez",
      amount: 450,
      currency: "USD",
      method: "Stripe Escrow",
      status: "pending",
      at: new Date(now - 26 * 3600_000).toISOString(),
    },
    {
      id: "txn_90207",
      txnId: "TXN-90207",
      taskId: null,
      customer: "Julian Drake",
      amount: 75,
      currency: "USD",
      method: "PayPal Direct",
      status: "refunded",
      at: "2026-10-24T15:00:00.000Z",
    },
    {
      id: "txn_90206",
      txnId: "TXN-90206",
      taskId: null,
      customer: "Eliza Smith",
      amount: 1200,
      currency: "USD",
      method: "Bank Wire",
      status: "completed",
      at: "2026-10-22T12:00:00.000Z",
    },
  ];
}

function mapLiveStatus(status: string): PaymentTxnStatus {
  const s = status.toLowerCase();
  if (s.includes("refund")) return "refunded";
  if (s.includes("pend") || s.includes("approv")) return "pending";
  return "completed";
}

/**
 * Client-safe stubs. Live Nest ledger: GET paymentsSummary / paymentsTransactions.
 * Also merges any rows from existing dashboardApi.getPaymentsOverview().
 */
export const paymentsOverviewApi = {
  async getSummary(): Promise<PaymentSummaryMetric[]> {
    // TODO(backend): GET API_ENDPOINTS.agents.paymentsSummary
    return stubSummary();
  },

  async getTransactions(): Promise<PaymentTransactionRow[]> {
    // TODO(backend): GET API_ENDPOINTS.agents.paymentsTransactions
    const live = await dashboardApi.getPaymentsOverview().catch(() => null);
    if (live && live.transactions.length > 0) {
      return live.transactions.map((t) => ({
        id: t.id,
        txnId: t.id.toUpperCase().startsWith("TXN")
          ? t.id.toUpperCase()
          : `TXN-${t.id.slice(-5).toUpperCase()}`,
        taskId: t.taskId,
        customer: t.merchant,
        amount: t.amount,
        currency: "USD",
        method: "Card",
        status: mapLiveStatus(t.status),
        at: t.at,
      }));
    }
    return stubTransactions();
  },
};
