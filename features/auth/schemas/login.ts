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

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, USER_MESSAGES.passwordRequired),
  rememberMe: z.boolean().optional(),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

export function parseLoginFormData(formData: FormData) {
  return loginFormSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    rememberMe:
      formData.get("rememberMe") === "on" ||
      formData.get("rememberMe") === "true",
  });
}

export function validateEmailField(value: string): string | undefined {
  const result = emailSchema.safeParse(value);
  if (result.success) return undefined;
  const issue = result.error.issues[0];
  return issue?.message ?? USER_MESSAGES.emailInvalid;
}

export function validatePasswordField(value: string): string | undefined {
  if (!value) return USER_MESSAGES.passwordRequired;
  return undefined;
}

export function isLoginFormValid(email: string, password: string): boolean {
  return (
    validateEmailField(email) === undefined &&
    validatePasswordField(password) === undefined
  );
}

export function normalizeLoginEmail(value: string): string {
  return value.trim().toLowerCase();
}
