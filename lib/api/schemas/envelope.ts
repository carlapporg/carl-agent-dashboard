import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "NETWORK_ERROR",
  "NOT_CONFIGURED",
]);

export const apiErrorBodySchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.array(z.string())).optional(),
});

export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export function apiFailureSchema() {
  return z.object({
    success: z.literal(false),
    error: apiErrorBodySchema,
  });
}

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([apiSuccessSchema(dataSchema), apiFailureSchema()]);
}
