export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "DISABLED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "NOT_CONFIGURED";

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, string[]>;
};

export type ApiSuccessResponse<T> = {
  data: T;
};

/** NestJS-style error body from Backend */
export type NestErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

export type ApiFailureResponse = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;
