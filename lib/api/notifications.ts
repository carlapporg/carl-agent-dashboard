import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  parseNotificationItem,
  unwrapNotificationList,
} from "@/lib/notifications/parse-api";
import type { NotificationItem } from "@/types/dashboard";

function listPath(limit: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  return `${API_ENDPOINTS.agents.notifications}?${params.toString()}`;
}

/** Server-only. Do not import from Client Components — use notification actions. */
export const notificationsApi = {
  async list(limit = 50): Promise<NotificationItem[]> {
    const data = await apiRequest(listPath(limit), {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    return unwrapNotificationList(data)
      .map(parseNotificationItem)
      .filter((row): row is NotificationItem => Boolean(row))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  async markRead(id: string): Promise<void> {
    await apiRequest(API_ENDPOINTS.agents.notificationRead(id), {
      method: "PATCH",
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
  },

  async markAllRead(): Promise<number> {
    const data = await apiRequest(API_ENDPOINTS.agents.notificationsReadAll, {
      method: "POST",
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const nested =
        record.data && typeof record.data === "object"
          ? (record.data as Record<string, unknown>)
          : record;
      if (typeof nested.updated === "number") return nested.updated;
    }
    return 0;
  },
};
