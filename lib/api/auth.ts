import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { createMockLoginResponse } from "@/mocks/auth";
import {
  loginCredentialsSchema,
  loginResponseSchema,
  messageDataSchema,
  tokenPairSchema,
  type LoginCredentials,
  type LoginResponse,
  type TokenPair,
} from "@/types/auth";

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const parsed = loginCredentialsSchema.parse(credentials);

    if (!env.isApiConfigured) {
      return createMockLoginResponse(parsed);
    }

    return apiRequest(API_ENDPOINTS.auth.agentLogin, {
      method: "POST",
      body: {
        email: parsed.email,
        password: parsed.password,
      },
      schema: loginResponseSchema,
      skipAuth: true,
      skipRefresh: true,
      dedupe: false,
    });
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    return apiRequest(API_ENDPOINTS.auth.refresh, {
      method: "POST",
      body: { refreshToken },
      schema: tokenPairSchema,
      skipAuth: true,
      skipRefresh: true,
      dedupe: false,
    });
  },

  async logout(refreshToken: string): Promise<void> {
    if (!env.isApiConfigured) {
      return;
    }

    try {
      await apiRequest(API_ENDPOINTS.auth.logout, {
        method: "POST",
        body: { refreshToken },
        schema: messageDataSchema,
        skipAuth: true,
        skipRefresh: true,
        dedupe: false,
      });
    } catch {
      // Local session is cleared regardless.
    }
  },
};
