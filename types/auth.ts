import { z } from "zod";
import { agentUserSchema } from "@/types/user";

export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(6)
    .regex(/[0-9]/),
  rememberMe: z.boolean().optional(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresIn: z.number().int().positive().optional(),
  user: agentUserSchema,
});

export const sessionPayloadSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  user: agentUserSchema,
  expiresAt: z.number().int().positive().optional(),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export type LoginFormState = {
  success?: boolean;
  errors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
} | undefined;

export type ForgotPasswordFormState = {
  success?: boolean;
  errors?: {
    email?: string[];
  };
  message?: string;
} | undefined;
