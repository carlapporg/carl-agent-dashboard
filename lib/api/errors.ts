import type { ApiErrorBody, ApiErrorCode } from "@/types/api";
import type { AuthErrorKind } from "@/lib/api/public-messages";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  readonly retryable: boolean;
  readonly kind: AuthErrorKind;

  constructor(
    body: ApiErrorBody,
    status = 500,
    retryable?: boolean,
    kind: AuthErrorKind = "unknown",
  ) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
    this.details = body.details;
    this.kind = kind;
    this.retryable =
      retryable ??
      (body.code === "NETWORK_ERROR" ||
        body.code === "RATE_LIMITED" ||
        body.code === "SERVER_ERROR" ||
        status >= 500 ||
        status === 429);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRetryableError(error: unknown): boolean {
  return isApiError(error) && error.retryable;
}
