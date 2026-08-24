"use server";

import { revalidatePath } from "next/cache";
import { agentStatusFromUi } from "@/lib/api/map-task";
import { messagesApi } from "@/lib/api/messages";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";

function revalidateTask(taskId: string) {
  revalidatePath(ROUTES.tasks);
  revalidatePath(ROUTES.task(taskId));
  revalidatePath(ROUTES.inbox);
  revalidatePath(ROUTES.messages);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.history);
}

export async function startTaskAction(taskId: string) {
  await tasksApi.start(taskId);
  revalidateTask(taskId);
}

export async function rejectTaskAction(taskId: string, reason: string) {
  await tasksApi.reject(taskId, reason);
  revalidateTask(taskId);
}

export async function updateTaskAgentStatusAction(
  taskId: string,
  status: "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_USER",
  note?: string,
) {
  await tasksApi.updateAgentStatus(taskId, status, note);
  revalidateTask(taskId);
}

export async function requestApprovalAction(
  _taskId: string,
  _formData?: FormData,
) {
  throw new Error("Payment APIs are not in the agent contract.");
}

export async function acceptTaskAction(_taskId: string) {
  throw new Error("Use Start — tasks are auto-assigned.");
}

export async function confirmItineraryAction(_parentTaskId: string) {}
export async function generateItineraryAction(_parentTaskId: string) {}
export async function sendItineraryAction(_parentTaskId: string) {}
export async function uploadReceiptAction(_taskId: string, _formData: FormData) {}
export async function toggleStepAction(_taskId: string, _step: string) {}
export async function updateTaskStatusAction(
  taskId: string,
  status: import("@/types/task").TaskStatus,
) {
  const mapped = agentStatusFromUi(status);
  if (!mapped) return;
  await updateTaskAgentStatusAction(taskId, mapped);
}

export type MarkPaidState = { success?: boolean; message?: string } | undefined;
export async function markPaidAction(
  _taskId: string,
  _prev: MarkPaidState,
  _formData: FormData,
): Promise<MarkPaidState> {
  return { message: "Payments are not in the agent API." };
}

export async function sendUpdateAction(taskId: string, formData: FormData) {
  const content = String(formData.get("body") ?? formData.get("content") ?? "").trim();
  if (!content) return;
  await messagesApi.send(taskId, content);
  revalidateTask(taskId);
}

