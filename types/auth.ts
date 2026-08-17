import { z } from "zod";
import { backendUserSchema } from "@/types/user";

export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: backendUserSchema,
});

export const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export const messageDataSchema = z.object({
  message: z.string(),
});

export const sessionPayloadSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: backendUserSchema,
  rememberMe: z.boolean().optional(),
  expiresAt: z.number().int().positive().optional(),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export type LoginFormState =
  | {
      success?: boolean;
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
