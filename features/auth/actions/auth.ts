"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { agentsApi } from "@/lib/api/agents";
import { apiRequest, clearServerAccessTokenMemory } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { toUserMessage, USER_MESSAGES } from "@/lib/api/error-handler";
import { isApiError } from "@/lib/api/errors";
import { logAuthEvent } from "@/lib/auth/audit-log";
import {
  assertLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  throttleKey,
} from "@/lib/auth/login-throttle";
import {
  createSession,
  destroySession,
  getSession,
  updateSessionUser,
} from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { ROUTES } from "@/lib/constants/routes";
import { parseLoginFormData } from "@/features/auth/schemas/login";
import { parseRegisterFormData } from "@/features/auth/schemas/register";
import { backendUserSchema } from "@/types/user";
import type { LoginFormState, RegisterFormState } from "@/types/auth";

async function clientKey(email: string): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "unknown";
  return throttleKey(ip, email);
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const validated = parseLoginFormData(formData);

  if (!validated.success) {
    const fieldErrors = validated.error.flatten().fieldErrors;
    return {
      errors: {
        email: fieldErrors.email,
        password: fieldErrors.password,
      },
    };
  }

  const email = validated.data.email;
  const key = await clientKey(email);

  // .env.staging / .env.production are gitignored — Vercel must set API_BASE_URL.
  if (!env.isApiConfigured) {
    logAuthEvent("login_failed", { email, reason: "api_not_configured" });
    return { message: USER_MESSAGES.apiNotConfigured };
  }

  try {
    assertLoginAllowed(key);
  } catch (error) {
    logAuthEvent("login_failed", { email, reason: "rate_limited" });
    return { message: toUserMessage(error, USER_MESSAGES.rateLimited) };
  }

  try {
    clearServerAccessTokenMemory();
    const result = await authApi.login({
      email,
      password: validated.data.password,
      rememberMe: validated.data.rememberMe,
    });

    if (result.user.role !== "AGENT") {
      recordLoginFailure(key);
      logAuthEvent("login_failed", { email, reason: "wrong_role" });
      await destroySession();
      return { message: USER_MESSAGES.unauthorizedApp };
    }

    await destroySession();
    try {
      await createSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        rememberMe: Boolean(validated.data.rememberMe),
      });
    } catch (sessionError) {
      recordLoginFailure(key);
      logAuthEvent("login_failed", {
        email,
        reason: "session_cookie",
        status: undefined,
      });
      const detail =
        sessionError instanceof Error ? sessionError.message : "";
      if (/cookie|size|large/i.test(detail)) {
        return {
          message:
            "Sign-in succeeded but the session cookie is too large for the browser. Contact support.",
        };
      }
      return { message: USER_MESSAGES.unknown };
    }

    try {
      const profile = await apiRequest(API_ENDPOINTS.agents.me, {
        method: "GET",
        schema: backendUserSchema,
        token: result.accessToken,
        dedupe: false,
      });
      if (profile.role !== "AGENT") {
        recordLoginFailure(key);
        logAuthEvent("login_failed", { email, reason: "wrong_role" });
        await destroySession();
        return { message: USER_MESSAGES.unauthorizedApp };
      }
      if (profile.id !== result.user.id) {
        recordLoginFailure(key);
        logAuthEvent("login_failed", { email, reason: "session_mismatch" });
        await destroySession();
        return { message: USER_MESSAGES.serverUnavailable };
      }
      await updateSessionUser(profile);
    } catch {
      // Login payload user is already from Backend.
    }

    // Agents start Available so Nest can offer tasks as soon as the socket connects.
    try {
      await agentsApi.setAvailability("AVAILABLE", result.accessToken);
    } catch {
      // Socket connect will re-assert presence; do not block login.
    }

    recordLoginSuccess(key);
    logAuthEvent("login_success", { email });
  } catch (error) {
    recordLoginFailure(key);
    logAuthEvent("login_failed", {
      email,
      reason: isApiError(error) ? error.kind : "unknown",
      status: isApiError(error) ? error.status : undefined,
    });
    return {
      message: toUserMessage(error),
    };
  }

  return { success: true };
}

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const validated = parseRegisterFormData(formData);

  if (!validated.success) {
    const fieldErrors = validated.error.flatten().fieldErrors;
    return {
      errors: {
        email: fieldErrors.email,
        password: fieldErrors.password,
        confirmPassword: fieldErrors.confirmPassword,
        firstName: fieldErrors.firstName,
        lastName: fieldErrors.lastName,
      },
    };
  }

  const { email, password, firstName, lastName } = validated.data;
  const key = await clientKey(email);

  try {
    assertLoginAllowed(key);
  } catch (error) {
    logAuthEvent("register_failed", { email, reason: "rate_limited" });
    return { message: toUserMessage(error, USER_MESSAGES.rateLimited) };
  }

  try {
    clearServerAccessTokenMemory();
    const registered = await authApi.register({
      email,
      password,
      firstName,
      lastName,
    });

    if (registered.role !== "AGENT") {
      recordLoginFailure(key);
      logAuthEvent("register_failed", { email, reason: "wrong_role" });
      return { message: USER_MESSAGES.unauthorizedApp };
    }

    const result = await authApi.login({
      email,
      password,
      rememberMe: false,
    });

    if (result.user.role !== "AGENT") {
      recordLoginFailure(key);
      logAuthEvent("register_failed", { email, reason: "wrong_role" });
      await destroySession();
      return { message: USER_MESSAGES.unauthorizedApp };
    }

    await destroySession();
    await createSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      rememberMe: false,
    });

    try {
      const profile = await apiRequest(API_ENDPOINTS.agents.me, {
        method: "GET",
        schema: backendUserSchema,
        token: result.accessToken,
        dedupe: false,
      });
      if (profile.role === "AGENT" && profile.id === result.user.id) {
        await updateSessionUser(profile);
      }
    } catch {
      // Registered user payload is sufficient.
    }

    try {
      await agentsApi.setAvailability("AVAILABLE", result.accessToken);
    } catch {
      // Socket connect will re-assert presence.
    }

    recordLoginSuccess(key);
    logAuthEvent("register_success", { email });
  } catch (error) {
    recordLoginFailure(key);
    logAuthEvent("register_failed", {
      email,
      reason: isApiError(error) ? error.kind : "unknown",
      status: isApiError(error) ? error.status : undefined,
    });
    return {
      message: toUserMessage(error),
    };
  }

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  logAuthEvent("logout", { email: session?.user.email });

  if (session?.refreshToken) {
    await authApi.logout(session.refreshToken);
  }

  await destroySession();
  redirect(ROUTES.login);
}

export async function clearSessionAfterPasswordChangeAction(): Promise<void> {
  await destroySession();
  redirect(`${ROUTES.login}?passwordChanged=1`);
}
