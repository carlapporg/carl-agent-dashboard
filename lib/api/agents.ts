import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { mockAgentUser } from "@/mocks/auth";
import { messageDataSchema } from "@/types/auth";
import { backendUserSchema, type BackendUser } from "@/types/user";
import { z } from "zod";

export const agentsApi = {
  async me(): Promise<BackendUser> {
    if (!env.isApiConfigured) {
      return mockAgentUser;
    }

    return apiRequest(API_ENDPOINTS.agents.me, {
      method: "GET",
      schema: backendUserSchema,
    });
  },

  async updateMe(input: {
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<BackendUser> {
    if (!env.isApiConfigured) {
      return {
        ...mockAgentUser,
        firstName: input.firstName ?? mockAgentUser.firstName,
        lastName: input.lastName ?? mockAgentUser.lastName,
      };
    }

    return apiRequest(API_ENDPOINTS.agents.me, {
      method: "PATCH",
      body: input,
      schema: backendUserSchema,
      dedupe: false,
    });
  },

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    if (!env.isApiConfigured) {
      return {
        message: "Password changed successfully. Please log in again.",
      };
    }

    return apiRequest(API_ENDPOINTS.agents.changePassword, {
      method: "POST",
      body: input,
      schema: messageDataSchema,
      dedupe: false,
      skipRefresh: true,
    });
  },
};

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(8, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must differ from your current password",
    path: ["newPassword"],
  });
