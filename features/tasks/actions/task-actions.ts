"use server";

import { revalidatePath } from "next/cache";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import { agentStatusFromUi } from "@/lib/api/map-task";
import { messagesApi } from "@/lib/api/messages";
import { USER_MESSAGES } from "@/lib/api/public-messages";
import { confirmationApi } from "@/lib/api/confirmation";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";
import type { SendTaskConfirmationBody, TaskConfirmation } from "@/types/confirmation";

export type TaskActionResult = { ok: true } | { ok: false; message: string };

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
    return { ok: false, message: USER_MESSAGES.offerGone };
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
    await tasksApi.accept(taskId);
    revalidateWorkQueues();
    revalidateTaskPage(taskId);
    return { ok: true };
  } catch (error) {
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
): Promise<TaskActionResult> {
  try {
    await tasksApi.reject(taskId, reason);
    revalidateWorkQueues();
    return { ok: true };
  } catch (error) {
    return failOffer(error);
  }
}

export async function updateTaskAgentStatusAction(
  taskId: string,
  status: "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_USER",
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

export async function sendTaskConfirmationAction(
  taskId: string,
  body: SendTaskConfirmationBody,
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

