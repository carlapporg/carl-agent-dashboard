import { z } from "zod";
import { USER_MESSAGES } from "@/lib/api/public-messages";

const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, USER_MESSAGES.emailRequired)
      .email(USER_MESSAGES.emailInvalid),
  );

export const registerFormSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(8, USER_MESSAGES.passwordMinLength),
    confirmPassword: z.string().min(8, USER_MESSAGES.passwordMinLength),
    firstName: z.string().trim().min(1, USER_MESSAGES.firstNameRequired).max(100),
    lastName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => value || undefined),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: USER_MESSAGES.passwordMismatch,
    path: ["confirmPassword"],
  });

export type RegisterFormInput = z.infer<typeof registerFormSchema>;

export function parseRegisterFormData(formData: FormData) {
  return registerFormSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
  });
}

export function validateRegisterEmail(value: string): string | undefined {
  const result = emailSchema.safeParse(value);
  if (result.success) return undefined;
  return result.error.issues[0]?.message ?? USER_MESSAGES.emailInvalid;
}

export function validateRegisterPassword(value: string): string | undefined {
  if (!value) return USER_MESSAGES.passwordRequired;
  if (value.length < 8) return USER_MESSAGES.passwordMinLength;
  return undefined;
}

export function validateRegisterConfirmPassword(
  password: string,
  confirmPassword: string,
): string | undefined {
  if (!confirmPassword) return USER_MESSAGES.passwordRequired;
  if (password !== confirmPassword) return USER_MESSAGES.passwordMismatch;
  return undefined;
}

export function validateRegisterFirstName(value: string): string | undefined {
  if (!value.trim()) return USER_MESSAGES.firstNameRequired;
  if (value.trim().length > 100) return "First name is too long";
  return undefined;
}

export function isRegisterFormValid(
  email: string,
  password: string,
  confirmPassword: string,
  firstName: string,
): boolean {
  return (
    validateRegisterEmail(email) === undefined &&
    validateRegisterPassword(password) === undefined &&
    validateRegisterConfirmPassword(password, confirmPassword) === undefined &&
    validateRegisterFirstName(firstName) === undefined
  );
}
