/**
 * Tracks whether a task details confirmation is known to exist for a task.
 * Used so we can safely GET confirmation after decline → IN_PROGRESS without
 * probing Nest on a fresh IN_PROGRESS task (which 404s).
 */
const KEY = "carl.agent.confirmation-known";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}

export function markTaskConfirmationKnown(taskId: string) {
  if (!taskId) return;
  const next = readSet();
  if (next.has(taskId)) return;
  next.add(taskId);
  writeSet(next);
}

export function isTaskConfirmationKnown(taskId: string): boolean {
  if (!taskId) return false;
  return readSet().has(taskId);
}

const RECEIPT_KEY = "carl.agent.receipt-known";

function readReceiptSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(RECEIPT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeReceiptSet(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RECEIPT_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function markTaskReceiptKnown(taskId: string) {
  if (!taskId) return;
  const next = readReceiptSet();
  if (next.has(taskId)) return;
  next.add(taskId);
  writeReceiptSet(next);
}

export function isTaskReceiptKnown(taskId: string): boolean {
  if (!taskId) return false;
  return readReceiptSet().has(taskId);
}
