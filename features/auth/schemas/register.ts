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

export const PASSWORD_CHECKS = [
  {
    id: "lower",
    label: "At least one lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "upper",
    label: "At least one uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "At least one number",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "length",
    label: "Minimum 8 characters",
    test: (value: string) => value.length >= 8,
  },
] as const;

export function passwordCheckResults(password: string) {
  return PASSWORD_CHECKS.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));
}

export function validateRegisterPassword(value: string): string | undefined {
  if (!value) return USER_MESSAGES.passwordRequired;
  const failed = PASSWORD_CHECKS.find((rule) => !rule.test(value));
  if (!failed) return undefined;
  if (failed.id === "length") return USER_MESSAGES.passwordMinLength;
  return failed.label;
}

const passwordSchema = z.string().superRefine((value, ctx) => {
  const error = validateRegisterPassword(value);
  if (error) {
    ctx.addIssue({ code: "custom", message: error });
  }
});

export const registerFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, USER_MESSAGES.passwordRequired),
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
