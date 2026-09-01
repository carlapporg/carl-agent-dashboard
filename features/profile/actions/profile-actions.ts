"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agentsApi } from "@/lib/api/agents";
import { toUserMessage } from "@/lib/api/error-handler";
import { isApiError } from "@/lib/api/errors";
import { validateAvatarFile } from "@/lib/agent/avatar";
import { destroySession, getSession, updateSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";
import type { BackendUser } from "@/types/user";
import { z } from "zod";

export type ProfileNameState = {
  success?: boolean;
  message?: string;
  user?: BackendUser;
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

export type AvatarUploadState = {
  success?: boolean;
  message?: string;
  user?: BackendUser;
} | undefined;

const avatarFileSchema = z.custom<File>(
  (value) =>
    typeof File !== "undefined" && value instanceof File && value.size > 0,
  { message: "Choose an image to upload." },
);

const nameSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name")
    .max(100, "First name is too long"),
  lastName: z
    .string()
    .trim()
    .max(100, "Last name is too long")
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
    revalidatePath(ROUTES.profile);
    revalidatePath(ROUTES.profileEdit);
    revalidatePath(ROUTES.dashboard);
    return { success: true, message: "Name updated.", user };
  } catch (error) {
    return {
      message: toUserMessage(error),
    };
  }
}

export async function uploadAgentAvatarAction(
  _prev: AvatarUploadState,
  formData: FormData,
): Promise<AvatarUploadState> {
  const parsed = avatarFileSchema.safeParse(formData.get("file"));
  if (!parsed.success) {
    return { message: "Choose an image to upload." };
  }

  const file = parsed.data;
  const validation = validateAvatarFile(file);
  if (validation) {
    return { message: validation };
  }

  try {
    const uploaded = await agentsApi.uploadAvatar(file);
    const session = await getSession();
    const baseUser = session?.user;
    const user = baseUser
      ? {
          ...baseUser,
          avatarUrl: uploaded.avatarUrl,
          updatedAt: new Date().toISOString(),
        }
      : await agentsApi.fetchMe();
    await updateSessionUser(user);
    revalidatePath(ROUTES.profile);
    revalidatePath(ROUTES.profileEdit);
    revalidatePath(ROUTES.dashboard);
    return { success: true, message: "Profile photo updated.", user };
  } catch (error) {
    if (isApiError(error) && error.kind === "server") {
      return {
        message:
          "Upload failed on the server. Confirm the live API is reachable and try again.",
      };
    }
    return { message: toUserMessage(error) };
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
    return {
      message: toUserMessage(error),
      errors:
        isApiError(error) && error.kind === "wrong_password"
          ? { currentPassword: [error.message] }
          : undefined,
    };
  }

  await destroySession();
  redirect(`${ROUTES.login}?passwordChanged=1`);
}
