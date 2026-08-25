import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export const notificationsApi = {
  async saveFcmToken(token: string): Promise<{ message: string }> {
    return apiRequest(API_ENDPOINTS.notifications.fcmToken, {
      method: "PUT",
      body: { token },
      schema: z.object({ message: z.string() }).passthrough(),
      dedupe: false,
    });
  },
};
