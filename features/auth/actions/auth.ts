"use server";

import { redirect } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { ROUTES } from "@/lib/constants/routes";
import {
  parseForgotPasswordFormData,
  parseLoginFormData,
} from "@/features/auth/schemas/login";
import type { ForgotPasswordFormState, LoginFormState } from "@/types/auth";

const STUB_AUTH_DELAY_MS = 650;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  try {
    if (env.authStubMode) {
      await delay(STUB_AUTH_DELAY_MS);
    }

    const result = await authApi.login(validated.data);

    await createSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      expiresAt:
        result.expiresIn != null
          ? Date.now() + result.expiresIn * 1000
          : undefined,
    });
  } catch (error) {
    if (isApiError(error)) {
      return {
        message: error.message || "Incorrect email or password",
      };
    }

    return {
      message: "Something went wrong. Please try again.",
    };
  }

  return { success: true };
}

export async function forgotPasswordAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const validated = parseForgotPasswordFormData(formData);

  if (!validated.success) {
    return {
      errors: {
        email: validated.error.flatten().fieldErrors.email,
      },
    };
  }

  await delay(STUB_AUTH_DELAY_MS);

  return {
    success: true,
    message: "If that email exists, we've sent a reset link.",
  };
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();

  if (session?.accessToken) {
    await authApi.logout();
  }

  await destroySession();
  redirect(ROUTES.login);
}
