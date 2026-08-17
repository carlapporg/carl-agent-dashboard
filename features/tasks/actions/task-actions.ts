"use server";

import { revalidatePath } from "next/cache";
import { itineraryApi } from "@/lib/api/itinerary";
import { isApiError } from "@/lib/api/errors";
import { messagesApi } from "@/lib/api/messages";
import { paymentsApi, receiptsApi } from "@/lib/api/payments";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";
import type { TaskStatus } from "@/types/task";

function revalidateTask(taskId: string) {
  revalidatePath(ROUTES.tasks);
  revalidatePath(ROUTES.task(taskId));
  revalidatePath(ROUTES.taskPayments(taskId));
  revalidatePath(ROUTES.inbox);
  revalidatePath(ROUTES.dashboard);
}

export async function acceptTaskAction(taskId: string) {
  await tasksApi.accept(taskId);
  revalidateTask(taskId);
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  await tasksApi.updateStatus(taskId, status);
  revalidateTask(taskId);
}

export async function addTaskNoteAction(taskId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await tasksApi.addNote(taskId, body);
  revalidateTask(taskId);
}

export async function toggleStepAction(taskId: string, step: string) {
  await tasksApi.toggleStep(taskId, step);
  revalidateTask(taskId);
}

export async function sendUpdateAction(taskId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await messagesApi.send(taskId, body, true);
  revalidateTask(taskId);
}

export async function requestApprovalAction(taskId: string, formData: FormData) {
  const amount = Number(formData.get("amount"));
  const merchant = String(formData.get("merchant") ?? "").trim();
  const merchantCategory = String(formData.get("merchantCategory") ?? "").trim();
  if (!merchant || !Number.isFinite(amount) || amount <= 0) return;
  await paymentsApi.requestApproval(taskId, {
    amount,
    merchant,
    merchantCategory: merchantCategory || undefined,
  });
  revalidateTask(taskId);
}

export type MarkPaidState =
  | {
      success?: boolean;
      message?: string;
    }
  | undefined;

export async function markPaidAction(
  taskId: string,
  _prev: MarkPaidState,
  formData: FormData,
): Promise<MarkPaidState> {
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { message: "Enter a valid amount." };
  }
  try {
    await paymentsApi.markPaid(taskId, amount);
  } catch (error) {
    return {
      message: isApiError(error)
        ? error.message
        : "Couldn’t record that charge. Check the remaining approval.",
    };
  }
  revalidateTask(taskId);
  return { success: true, message: "Charge recorded." };
}

export async function uploadReceiptAction(taskId: string, formData: FormData) {
  const fileName = String(formData.get("fileName") ?? "").trim();
  const amountRaw = formData.get("amount");
  const merchant = String(formData.get("merchant") ?? "").trim();
  if (!fileName) return;
  const amount =
    amountRaw && String(amountRaw).trim()
      ? Number(amountRaw)
      : undefined;
  await receiptsApi.upload(taskId, {
    fileName,
    amount: Number.isFinite(amount) ? amount : undefined,
    merchant: merchant || undefined,
  });
  revalidateTask(taskId);
}

export async function generateItineraryAction(parentTaskId: string) {
  try {
    await itineraryApi.generate(parentTaskId);
  } catch {
    return;
  }
  revalidateTask(parentTaskId);
}
