import { cache } from "react";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { mockAgentUser } from "@/mocks/auth";
import { messageDataSchema } from "@/types/auth";
import { backendUserSchema, type BackendUser } from "@/types/user";

const getAgentMe = cache(async (): Promise<BackendUser> => {
  if (!env.isApiConfigured) {
    return mockAgentUser;
  }

  return apiRequest(API_ENDPOINTS.agents.me, {
    method: "GET",
    schema: backendUserSchema,
  });
});

export const agentsApi = {
  me: getAgentMe,

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
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
      schema: messageDataSchema,
      dedupe: false,
      authContext: "password",
    });
  },
};
