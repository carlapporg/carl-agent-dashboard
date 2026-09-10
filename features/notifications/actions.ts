"use server";

import { notificationsApi } from "@/lib/api/notifications";
import type { NotificationItem } from "@/types/dashboard";

export async function listNotificationsAction(
  limit = 50,
): Promise<NotificationItem[]> {
  try {
    return await notificationsApi.list(limit);
  } catch {
    return [];
  }
}

export async function markNotificationReadAction(id: string): Promise<void> {
  await notificationsApi.markRead(id);
}

export async function markAllNotificationsReadAction(): Promise<number> {
  try {
    return await notificationsApi.markAllRead();
  } catch {
    return 0;
  }
}
