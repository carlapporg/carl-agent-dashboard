import { z } from "zod";

const passwordSchema = z
  .string()
  .min(1, "Enter your password")
  .min(6, "Password must be at least 6 characters")
  .regex(/[0-9]/, "Password must include at least one number");

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email"),
  password: passwordSchema,
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email"),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

export function parseLoginFormData(formData: FormData) {
  return loginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe:
      formData.get("rememberMe") === "on" ||
      formData.get("rememberMe") === "true",
  });
}

export function parseForgotPasswordFormData(formData: FormData) {
  return forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
}

export function validateEmailField(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your email";
  const result = z.string().email().safeParse(trimmed);
  if (!result.success) return "Enter a valid email";
  return undefined;
}

export function validatePasswordField(value: string): string | undefined {
  if (!value) return "Enter your password";
  if (value.length < 6) return "Password must be at least 6 characters";
  if (!/[0-9]/.test(value)) return "Password must include at least one number";
  return undefined;
}

export function isLoginFormValid(email: string, password: string): boolean {
  return (
    validateEmailField(email) === undefined &&
    validatePasswordField(password) === undefined
  );
}
