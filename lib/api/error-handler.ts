import { isApiError } from "@/lib/api/errors";
import {
  messageForKind,
  type AuthErrorKind,
  USER_MESSAGES,
} from "@/lib/api/public-messages";

/**
 * Single place UI reads error copy from.
 * Never forwards Backend / stack / database text.
 */
export function toUserMessage(
  error: unknown,
  fallback: string = USER_MESSAGES.unknown,
): string {
  if (isApiError(error)) {
    return error.message || fallback;
  }
  return fallback;
}

export function kindFromApiError(error: unknown): AuthErrorKind {
  if (!isApiError(error)) return "unknown";
  return error.kind ?? "unknown";
}

export { USER_MESSAGES };
