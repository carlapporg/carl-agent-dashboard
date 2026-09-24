"use server";

import { revalidatePath } from "next/cache";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import { agentStatusFromUi } from "@/lib/api/map-task";
import { messagesApi } from "@/lib/api/messages";
import { USER_MESSAGES } from "@/lib/api/public-messages";
import { confirmationApi } from "@/lib/api/confirmation";
import { receiptApi } from "@/lib/api/receipt";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";
import type { DraftTaskConfirmationBody, TaskConfirmation } from "@/types/confirmation";
import type { TimelineEvent } from "@/types/message";

export type OfferLiveState = "offered" | "accepted" | "rejected" | "gone";

export type TaskActionResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      gone?: boolean;
      reason?: "already_accepted" | "already_rejected" | "expired" | "gone";
    };

function revalidateWorkQueues() {
  revalidatePath(ROUTES.tasks);
  revalidatePath(ROUTES.dashboard);
}

function revalidateTaskPage(taskId: string) {
  revalidatePath(ROUTES.task(taskId));
}

function fail(error: unknown): { ok: false; message: string } {
  return { ok: false, message: toUserMessage(error) };
}

function isGoneStatus(status: number): boolean {
  return status === 403 || status === 404 || status === 409 || status === 410;
}

function failOffer(error: unknown): TaskActionResult {
  if (isApiError(error) && isGoneStatus(error.status)) {
    const text = `${error.code} ${error.message}`.toUpperCase();
    const expired =
      error.status === 400 ||
      text.includes("EXPIRE") ||
      text.includes("WINDOW") ||
      text.includes("TOO_LATE") ||
      text.includes("REJECT_UNTIL");
    const alreadyAccepted =
      error.status === 409 ||
      text.includes("ASSIGNED") ||
      text.includes("ALREADY_ACCEPT") ||
      text.includes("ACCEPTED");
    return {
      ok: false,
      message: expired
        ? USER_MESSAGES.rejectWindowEnded
        : alreadyAccepted
          ? USER_MESSAGES.offerAlreadyAccepted
          : USER_MESSAGES.offerGone,
      gone: true,
      reason: expired
        ? "expired"
        : alreadyAccepted
          ? "already_accepted"
          : "gone",
    };
  }
  if (isApiError(error) && error.status === 400) {
    const text = `${error.code} ${error.message}`.toUpperCase();
    if (
      text.includes("EXPIRE") ||
      text.includes("WINDOW") ||
      text.includes("TOO_LATE") ||
      text.includes("REJECT_UNTIL")
    ) {
      return {
        ok: false,
        message: USER_MESSAGES.rejectWindowEnded,
        reason: "expired",
      };
    }
  }
  return fail(error);
}

function failAssigned(error: unknown): TaskActionResult {
  if (isApiError(error) && isGoneStatus(error.status)) {
    return { ok: false, message: USER_MESSAGES.taskGone };
  }
  return fail(error);
}

export async function acceptTaskAction(taskId: string): Promise<TaskActionResult> {
  try {
    const live = await getOfferLiveStateAction(taskId);
    if (live === "accepted") {
      revalidateWorkQueues();
      revalidateTaskPage(taskId);
      return { ok: true };
    }
    if (live === "rejected") {
      return {
        ok: false,
        message: "This offer was already rejected.",
        reason: "already_rejected",
      };
    }
    if (live === "gone") {
      return {
        ok: false,
        message: USER_MESSAGES.offerGone,
        gone: true,
        reason: "gone",
      };
    }
    await tasksApi.accept(taskId);
    revalidateWorkQueues();
    revalidateTaskPage(taskId);
    return { ok: true };
  } catch (error) {
    const live = await getOfferLiveStateAction(taskId).catch(() => null);
    if (live === "accepted") {
      revalidateWorkQueues();
      revalidateTaskPage(taskId);
      return { ok: true };
    }
    if (live === "rejected") {
      return {
        ok: false,
        message: "This offer was already rejected.",
        reason: "already_rejected",
      };
    }
    return failOffer(error);
  }
}

export async function startTaskAction(taskId: string): Promise<TaskActionResult> {
  try {
    await tasksApi.start(taskId);
    revalidateWorkQueues();
    return { ok: true };
  } catch (error) {
    return failAssigned(error);
  }
}

export async function rejectTaskAction(
  taskId: string,
  reason: string,
  options?: { revalidate?: boolean },
): Promise<TaskActionResult> {
  try {
    await tasksApi.reject(taskId, reason);
    if (options?.revalidate !== false) {
      revalidateWorkQueues();
      revalidatePath(ROUTES.history);
      revalidatePath(ROUTES.messages);
    }
    return { ok: true };
  } catch (error) {
    return failOffer(error);
  }
}

export async function getOfferLiveStateAction(
  taskId: string,
): Promise<OfferLiveState> {
  try {
    const task = await tasksApi.get(taskId);
    if (task.backendStatus === "REJECTED") return "rejected";
    if (task.backendStatus === "OFFERED" || task.backendStatus === "QUEUED") {
      return "offered";
    }
    return "accepted";
  } catch (error) {
    if (isApiError(error) && isGoneStatus(error.status)) return "gone";
    throw error;
  }
}

export async function updateTaskAgentStatusAction(
  taskId: string,
  status:
    | "IN_PROGRESS"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "WAITING_FOR_USER",
  note?: string,
): Promise<TaskActionResult> {
  try {
    await tasksApi.updateAgentStatus(taskId, status, note);
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      revalidateWorkQueues();
      revalidatePath(ROUTES.history);
    }
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export type SendMessageResult =
  | { ok: true; event: Awaited<ReturnType<typeof messagesApi.send>> }
  | { ok: false; message: string };

export async function listTaskMessagesAction(
  taskId: string,
): Promise<
  | { ok: true; events: TimelineEvent[] }
  | { ok: false; message: string }
> {
  try {
    const events = await messagesApi.list(taskId);
    return { ok: true, events };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}

export async function sendTaskMessageAction(
  taskId: string,
  content: string,
): Promise<SendMessageResult> {
  const text = content.trim();
  if (!text) return { ok: false, message: "Write a message first." };
  try {
    const event = await messagesApi.send(taskId, text);
    return { ok: true, event };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}

/** ACK: customer messages arrived on this agent device. */
export async function markMessagesDeliveredAction(
  taskId: string,
  messageIds?: string[],
): Promise<void> {
  try {
    await messagesApi.markDelivered(taskId, messageIds);
  } catch {
    /* best-effort */
  }
}

/** ACK: agent has chat open / messages visible. */
export async function markMessagesReadAction(
  taskId: string,
  messageIds?: string[],
): Promise<void> {
  try {
    await messagesApi.markRead(taskId, messageIds);
  } catch {
    /* best-effort */
  }
}

export async function requestApprovalAction(
  _taskId: string,
  _formData?: FormData,
) {
  throw new Error("Payment APIs are not in the agent contract.");
}

export async function confirmItineraryAction(_parentTaskId: string) {}
export async function generateItineraryAction(_parentTaskId: string) {}
export async function sendItineraryAction(_parentTaskId: string) {}
export async function uploadReceiptAction(_taskId: string, _formData: FormData) {}
export async function toggleStepAction(_taskId: string, _step: string) {}
export async function updateTaskStatusAction(
  taskId: string,
  status: import("@/types/task").TaskStatus,
): Promise<TaskActionResult> {
  if (status === "waiting_for_customer") {
    return {
      ok: false,
      message: "Waiting for Customer is set when you send the final confirmation.",
    };
  }
  const mapped = agentStatusFromUi(status);
  if (!mapped) return { ok: true };
  return updateTaskAgentStatusAction(taskId, mapped);
}

export type MarkPaidState = { success?: boolean; message?: string } | undefined;
export async function markPaidAction(
  _taskId: string,
  _prev: MarkPaidState,
  _formData: FormData,
): Promise<MarkPaidState> {
  return { message: "Payments are not in the agent API." };
}

export async function sendUpdateAction(
  taskId: string,
  formData: FormData | string,
): Promise<SendMessageResult> {
  const content =
    typeof formData === "string"
      ? formData.trim()
      : String(formData.get("body") ?? formData.get("content") ?? "").trim();
  return sendTaskMessageAction(taskId, content);
}

export type ConfirmationActionResult =
  | { ok: true; confirmation: TaskConfirmation }
  | { ok: false; message: string };

export async function createTaskConfirmationDraftAction(
  taskId: string,
  body: DraftTaskConfirmationBody,
): Promise<ConfirmationActionResult> {
  try {
    const confirmation = await confirmationApi.createDraft(taskId, body);
    revalidateWorkQueues();
    revalidateTaskPage(taskId);
    return { ok: true, confirmation };
  } catch (error) {
    return fail(error);
  }
}

export async function sendTaskConfirmationDraftAction(
  taskId: string,
  confirmationId: string,
): Promise<ConfirmationActionResult> {
  try {
    const confirmation = await confirmationApi.sendDraft(
      taskId,
      confirmationId,
    );
    revalidateWorkQueues();
    revalidateTaskPage(taskId);
    return { ok: true, confirmation };
  } catch (error) {
    return fail(error);
  }
}

/** @deprecated Prefer createTaskConfirmationDraftAction + sendTaskConfirmationDraftAction. */
export async function sendTaskConfirmationAction(
  taskId: string,
  body: DraftTaskConfirmationBody,
): Promise<ConfirmationActionResult> {
  try {
    const confirmation = await confirmationApi.send(taskId, body);
    revalidateWorkQueues();
    revalidateTaskPage(taskId);
    return { ok: true, confirmation };
  } catch (error) {
    return fail(error);
  }
}

export async function getTaskConfirmationAction(
  taskId: string,
): Promise<{ ok: true; confirmation: TaskConfirmation | null } | { ok: false; message: string }> {
  try {
    const confirmation = await confirmationApi.get(taskId);
    return { ok: true, confirmation };
  } catch (error) {
    return fail(error);
  }
}

export type ReceiptActionResult =
  | { ok: true; receipt: import("@/types/receipt").TaskReceipt }
  | { ok: false; message: string };

export async function uploadTaskReceiptAction(
  taskId: string,
  formData: FormData,
): Promise<ReceiptActionResult> {
  try {
    const file = formData.get("file");
    if (typeof File === "undefined" || !(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Choose a receipt file first." };
    }
    const note = String(formData.get("note") ?? "").trim();
    const receipt = await receiptApi.upload(taskId, file, note);
    revalidateWorkQueues();
    revalidateTaskPage(taskId);
    return { ok: true, receipt };
  } catch (error) {
    return fail(error);
  }
}

export async function getTaskReceiptAction(
  taskId: string,
): Promise<
  | { ok: true; receipt: import("@/types/receipt").TaskReceipt | null }
  | { ok: false; message: string }
> {
  try {
    const receipt = await receiptApi.get(taskId);
    return { ok: true, receipt };
  } catch (error) {
    return fail(error);
  }
}

export type VenueRefreshActionResult =
  | {
      ok: true;
      query: string | null;
      suggestions: import("@/types/venue").VenueSuggestion[];
      metadata: Record<string, unknown> | null;
    }
  | { ok: false; message: string };

export async function refreshVenueSuggestionsAction(
  taskId: string,
): Promise<VenueRefreshActionResult> {
  try {
    const { venueSuggestionsApi } = await import(
      "@/lib/api/venue-suggestions"
    );
    const result = await venueSuggestionsApi.refresh(taskId);
    revalidateTaskPage(taskId);
    return {
      ok: true,
      query: result.query ?? null,
      suggestions: result.suggestions,
      metadata:
        result.metadata && typeof result.metadata === "object"
          ? (result.metadata as Record<string, unknown>)
          : null,
    };
  } catch (error) {
    return fail(error);
  }
}

function mapPaymentError(error: unknown): string {
  if (isApiError(error)) {
    const msg = error.message.toLowerCase();
    if (error.status === 503) {
      return "Stripe is not configured. Ask ops to enable Stripe.";
    }
    if (error.status === 403) {
      return "This task is not assigned to you.";
    }
    if (error.status === 400) {
      if (msg.includes("confirm")) {
        return "User must confirm booking first.";
      }
      if (
        msg.includes("open payment") ||
        msg.includes("already") ||
        msg.includes("exists")
      ) {
        return "An open payment already exists for this task.";
      }
      if (msg.includes("not ready") || msg.includes("waiting")) {
        return "Virtual card is not ready yet.";
      }
      if (msg.includes("spent") && msg.includes("cancel")) {
        return "Payment already spent — cannot cancel.";
      }
      if (msg.includes("cancelled")) {
        return "This card was cancelled.";
      }
    }
    return error.message || toUserMessage(error);
  }
  return toUserMessage(error);
}

export async function requestTaskPaymentAction(
  taskId: string,
  spendAmountCents: number,
  confirmationId?: string | null,
): Promise<
  | { ok: true; payment: import("@/types/task-payment").TaskPayment }
  | { ok: false; message: string }
> {
  try {
    const { taskPaymentsApi } = await import("@/lib/api/task-payments");
    const payment = await taskPaymentsApi.request(taskId, {
      spendAmountCents,
      currency: "usd",
      ...(confirmationId ? { confirmationId } : {}),
    });
    revalidateTaskPage(taskId);
    return { ok: true, payment };
  } catch (error) {
    return { ok: false, message: mapPaymentError(error) };
  }
}

export async function revealTaskPaymentCardAction(
  taskId: string,
  paymentId: string,
): Promise<
  | { ok: true; card: import("@/types/task-payment").VirtualCardSecrets }
  | { ok: false; message: string }
> {
  try {
    const { taskPaymentsApi } = await import("@/lib/api/task-payments");
    const card = await taskPaymentsApi.getCard(taskId, paymentId);
    return { ok: true, card };
  } catch (error) {
    return { ok: false, message: mapPaymentError(error) };
  }
}

export async function cancelTaskPaymentAction(
  taskId: string,
  paymentId: string,
): Promise<
  | { ok: true; payment: import("@/types/task-payment").TaskPayment }
  | { ok: false; message: string }
> {
  try {
    const { taskPaymentsApi } = await import("@/lib/api/task-payments");
    const payment = await taskPaymentsApi.cancel(taskId, paymentId);
    revalidateTaskPage(taskId);
    return { ok: true, payment };
  } catch (error) {
    return { ok: false, message: mapPaymentError(error) };
  }
}

