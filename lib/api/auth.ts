import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { createMockLoginResponse, mockAgentUser } from "@/mocks/auth";
import {
  loginCredentialsSchema,
  loginResponseSchema,
  type LoginCredentials,
  type LoginResponse,
} from "@/types/auth";
import { agentUserSchema, type AgentUser } from "@/types/user";

const logoutDataSchema = z.unknown().transform(() => undefined);

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const parsed = loginCredentialsSchema.parse(credentials);

    if (env.authStubMode) {
      return createMockLoginResponse(parsed);
    }

    return apiRequest(API_ENDPOINTS.auth.login, {
      method: "POST",
      body: parsed,
      schema: loginResponseSchema,
      skipAuth: true,
      dedupe: false,
    });
  },

  async logout(): Promise<void> {
    if (env.authStubMode || !env.isApiConfigured) {
      return;
    }

    try {
      await apiRequest(API_ENDPOINTS.auth.logout, {
        method: "POST",
        schema: logoutDataSchema,
        dedupe: false,
      });
    } catch {
      // session cleared locally regardless
    }
  },

  async me(): Promise<AgentUser> {
    if (env.authStubMode || !env.isApiConfigured) {
      return mockAgentUser;
    }

    return apiRequest(API_ENDPOINTS.auth.me, {
      method: "GET",
      schema: agentUserSchema,
    });
  },
};
