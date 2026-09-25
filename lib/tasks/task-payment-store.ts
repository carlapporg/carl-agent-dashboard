import type { TaskPayment, TaskPaymentStatus } from "@/types/task-payment";
import { isTaskPaymentUuid } from "@/types/task-payment";

const KEY = "carl.agent.task-payments";

type StoredPayment = {
  taskId: string;
  paymentId: string;
  status: TaskPaymentStatus;
  spendDisplay?: string;
  chargeDisplay?: string;
  last4?: string | null;
  brand?: string | null;
  currency?: string;
  updatedAt: string;
};

function readAll(): Record<string, StoredPayment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredPayment>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, StoredPayment>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function rememberTaskPayment(payment: TaskPayment) {
  if (!isTaskPaymentUuid(payment.id)) return;
  const map = readAll();
  map[payment.taskId] = {
    taskId: payment.taskId,
    paymentId: payment.id,
    status: payment.status,
    spendDisplay: payment.spendDisplay,
    chargeDisplay: payment.chargeDisplay,
    last4: payment.last4,
    brand: payment.brand,
    currency: payment.currency,
    updatedAt: payment.updatedAt || new Date().toISOString(),
  };
  writeAll(map);
}

export function patchStoredTaskPayment(
  taskId: string,
  patch: Partial<StoredPayment> & { paymentId?: string },
) {
  const map = readAll();
  const prev = map[taskId];
  const paymentId = patch.paymentId ?? prev?.paymentId;
  if (!isTaskPaymentUuid(paymentId)) return;
  map[taskId] = {
    taskId,
    paymentId,
    status: patch.status ?? prev?.status ?? "requires_payment",
    spendDisplay: patch.spendDisplay ?? prev?.spendDisplay,
    chargeDisplay: patch.chargeDisplay ?? prev?.chargeDisplay,
    last4: patch.last4 ?? prev?.last4,
    brand: patch.brand ?? prev?.brand,
    currency: patch.currency ?? prev?.currency,
    updatedAt: new Date().toISOString(),
  };
  writeAll(map);
}

export function readStoredTaskPayment(taskId: string): StoredPayment | null {
  const row = readAll()[taskId] ?? null;
  if (!row) return null;
  // Drop corrupted dummy ids (notification / Stripe) so reveal can recover.
  if (!isTaskPaymentUuid(row.paymentId)) {
    clearStoredTaskPayment(taskId);
    return null;
  }
  return row;
}

export function clearStoredTaskPayment(taskId: string) {
  const map = readAll();
  if (!map[taskId]) return;
  delete map[taskId];
  writeAll(map);
}
