import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { createMockLoginResponse, createMockRegisterResponse } from "@/mocks/auth";
import {
  loginCredentialsSchema,
  loginResponseSchema,
  registerCredentialsSchema,
  type LoginCredentials,
  type LoginResponse,
  type RegisterCredentials,
} from "@/types/auth";
import { backendUserSchema, type BackendUser } from "@/types/user";

export const authApi = {
  async register(credentials: RegisterCredentials): Promise<BackendUser> {
    const parsed = registerCredentialsSchema.parse(credentials);

    if (!env.isApiConfigured) {
      return createMockRegisterResponse(parsed);
    }

    return apiRequest(API_ENDPOINTS.auth.agentRegister, {
      method: "POST",
      body: {
        email: parsed.email,
        password: parsed.password,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
      },
      schema: backendUserSchema,
      skipAuth: true,
      skipRefresh: true,
      dedupe: false,
      authContext: "login",
    });
  },

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
