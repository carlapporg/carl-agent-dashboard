import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { createMockLoginResponse } from "@/mocks/auth";
import {
  loginCredentialsSchema,
  loginResponseSchema,
  type LoginCredentials,
  type LoginResponse,
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
      authContext: "login",
    });
  },

  async logout(_refreshToken: string): Promise<void> {
    // Logout endpoint is not in the current Backend surface.
  },
};
