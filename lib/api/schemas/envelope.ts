import { z } from "zod";

export const nestErrorSchema = z.object({
  statusCode: z.number().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
  error: z.string().optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

export function nestMessageToString(
  message: string | string[] | undefined,
  fallback: string,
): string {
  if (Array.isArray(message)) {
    return message.filter(Boolean).join(" ") || fallback;
  }
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return fallback;
}
