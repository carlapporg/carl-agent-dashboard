"use server";

import { agentsApi } from "@/lib/api/agents";
import { isApiError } from "@/lib/api/errors";
import {
  destroySession,
  updateSessionUser,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { z } from "zod";

export type ProfileNameState = {
  success?: boolean;
  message?: string;
  errors?: {
    firstName?: string[];
    lastName?: string[];
  };
} | undefined;

export type ChangePasswordState = {
  success?: boolean;
  message?: string;
  errors?: {
    currentPassword?: string[];
    newPassword?: string[];
    confirmPassword?: string[];
  };
} | undefined;

const nameSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name")
    .max(50, "First name is too long"),
  lastName: z
    .string()
    .trim()
    .max(50, "Last name is too long")
    .optional()
    .transform((v) => v || null),
});

const passwordSchema = z
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

export async function updateAgentNameAction(
  _prev: ProfileNameState,
  formData: FormData,
): Promise<ProfileNameState> {
  const parsed = nameSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      errors: {
        firstName: fieldErrors.firstName,
        lastName: fieldErrors.lastName,
      },
    };
  }

  try {
    const user = await agentsApi.updateMe({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    await updateSessionUser(user);
    return { success: true, message: "Name updated." };
  } catch (error) {
    return {
      message: isApiError(error)
        ? error.message
        : "Couldn’t save your name. Please try again.",
    };
  }
}

export async function changeAgentPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      errors: {
        currentPassword: fieldErrors.currentPassword,
        newPassword: fieldErrors.newPassword,
        confirmPassword: fieldErrors.confirmPassword,
      },
    };
  }

  try {
    await agentsApi.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return {
        message: "Current password is incorrect.",
        errors: {
          currentPassword: ["Current password is incorrect."],
        },
      };
    }
    return {
      message: isApiError(error)
        ? error.message
        : "Couldn’t change your password. Please try again.",
    };
  }

  await destroySession();
  redirect(`${ROUTES.login}?passwordChanged=1`);
}
