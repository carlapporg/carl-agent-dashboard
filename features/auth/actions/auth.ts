"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { agentsApi } from "@/lib/api/agents";
import { authApi } from "@/lib/api/auth";
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
import { ROUTES } from "@/lib/constants/routes";
import { parseLoginFormData } from "@/features/auth/schemas/login";
import { parseRegisterFormData } from "@/features/auth/schemas/register";
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

  try {
    assertLoginAllowed(key);
  } catch (error) {
    logAuthEvent("login_failed", { email, reason: "rate_limited" });
    return { message: toUserMessage(error, USER_MESSAGES.rateLimited) };
  }

  try {
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

    await createSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      rememberMe: Boolean(validated.data.rememberMe),
    });

    try {
      const profile = await agentsApi.me();
      if (profile.role !== "AGENT") {
        recordLoginFailure(key);
        logAuthEvent("login_failed", { email, reason: "wrong_role" });
        await destroySession();
        return { message: USER_MESSAGES.unauthorizedApp };
      }
      await updateSessionUser(profile);
    } catch {
      // Login payload user is already from Backend.
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

    await createSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      rememberMe: false,
    });

    try {
      const profile = await agentsApi.me();
      if (profile.role === "AGENT") {
        await updateSessionUser(profile);
      }
    } catch {
      // Registered user payload is sufficient.
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
