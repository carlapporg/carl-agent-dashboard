import { z } from "zod";

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email"),
  password: z
    .string()
    .min(1, "Enter your password")
    .min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
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

export function validateEmailField(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your email";
  const result = z.string().email().safeParse(trimmed);
  if (!result.success) return "Enter a valid email";
  return undefined;
}

export function validatePasswordField(value: string): string | undefined {
  if (!value) return "Enter your password";
  if (value.length < 8) return "Password must be at least 8 characters";
  return undefined;
}

export function isLoginFormValid(email: string, password: string): boolean {
  return (
    validateEmailField(email) === undefined &&
    validatePasswordField(password) === undefined
  );
}
