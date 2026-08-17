"use server";

import { redirect } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";
import { parseLoginFormData } from "@/features/auth/schemas/login";
import type { LoginFormState } from "@/types/auth";

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
    const result = await authApi.login(validated.data);

    await createSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      rememberMe: Boolean(validated.data.rememberMe),
    });
  } catch (error) {
    if (isApiError(error)) {
      return {
        message: error.message || "Unable to sign in. Please try again.",
      };
    }

    return {
      message: "Something went wrong. Please try again.",
    };
  }

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();

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
