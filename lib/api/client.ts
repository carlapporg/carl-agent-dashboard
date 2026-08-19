import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import {
  classifyAuthError,
  messageForKind,
  USER_MESSAGES,
} from "@/lib/api/public-messages";
import {
  nestErrorSchema,
} from "@/lib/api/schemas/envelope";
import { env } from "@/lib/config/env";
import { resolveAccessToken } from "@/lib/api/token";
import type { ApiErrorBody } from "@/types/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequestOptions<TSchema extends z.ZodTypeAny> = {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
  schema: TSchema;
  dedupe?: boolean;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  /** Maps 401 to invalid credentials instead of expired session. */
  authContext?: "login" | "api" | "password";
};

const REQUEST_TIMEOUT_MS = 20_000;
const inFlight = new Map<string, Promise<unknown>>();

function statusToCode(status: number, kind: string): ApiErrorBody["code"] {
  if (kind === "disabled") return "DISABLED";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 0) return "NETWORK_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  return "VALIDATION_ERROR";
}

function joinApiUrl(path: string): string {
  const base = env.apiBaseUrl;
  let suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix === "/api/v1") suffix = "/";
  if (suffix.startsWith("/api/v1/")) {
    suffix = suffix.slice("/api/v1".length);
  }
  return `${base}${suffix}`;
}

function dedupeKey(
  method: HttpMethod,
  url: string,
  body: unknown,
  token: string | null,
): string {
  return `${method}:${url}:${token ?? ""}:${body ? JSON.stringify(body) : ""}`;
}

function throwMappedError(
  status: number,
  internalMessage?: string | string[],
  errorLabel?: string,
  context: "login" | "api" | "password" = "api",
): never {
  const kind = classifyAuthError(status, internalMessage, errorLabel, context);
  const message = messageForKind(kind);
  throw new ApiError(
    {
      code: statusToCode(status, kind),
      message,
    },
    status || (kind === "network" ? 0 : 500),
    kind === "network" || kind === "server" || kind === "rate_limit",
    kind,
  );
}

function throwFromNestError(
  raw: unknown,
  httpStatus: number,
  context: "login" | "api" | "password",
): never {
  const parsed = nestErrorSchema.safeParse(raw);
  const status = parsed.success
    ? (parsed.data.statusCode ?? httpStatus)
    : httpStatus;
  throwMappedError(
    status,
    parsed.success ? parsed.data.message : undefined,
    parsed.success ? parsed.data.error : undefined,
    context,
  );
}

function parseSuccessData<TSchema extends z.ZodTypeAny>(
  raw: unknown,
  dataSchema: TSchema,
  httpStatus: number,
  context: "login" | "api" | "password",
): z.infer<TSchema> {
  if (!raw || typeof raw !== "object") {
    throwMappedError(httpStatus || 502, undefined, undefined, context);
  }

  const record = raw as Record<string, unknown>;

  if (!("data" in record)) {
    throwFromNestError(raw, httpStatus, context);
  }

  const dataParsed = dataSchema.safeParse(record.data);
  if (!dataParsed.success) {
    throwMappedError(httpStatus || 502, undefined, undefined, context);
  }

  return dataParsed.data;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  // Refresh is not in the current Backend surface. Expired access tokens require re-login.
  return null;
}

async function executeRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: ApiRequestOptions<TSchema>,
  token: string | null,
  hasRetried: boolean,
): Promise<z.infer<TSchema>> {
  const method = options.method ?? "GET";
  const url = joinApiUrl(path);
  const context = options.authContext ?? "api";

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal =
    options.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([options.signal, timeout])
      : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throwMappedError(0, undefined, undefined, context);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    if (!response.ok) {
      throwMappedError(response.status || 502, undefined, undefined, context);
    }
    throwMappedError(502, undefined, undefined, context);
  }

  if (
    response.status === 401 &&
    !options.skipAuth &&
    !options.skipRefresh &&
    !hasRetried
  ) {
    const nextToken = await tryRefreshAccessToken();
    if (nextToken) {
      return executeRequest(path, options, nextToken, true);
    }
    throwMappedError(401, undefined, undefined, "api");
  }

  if (!response.ok) {
    throwFromNestError(raw, response.status, context);
  }

  return parseSuccessData(raw, options.schema, response.status, context);
}

export async function apiRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: ApiRequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  if (!env.isApiConfigured) {
    throw new ApiError(
      {
        code: "NOT_CONFIGURED",
        message: USER_MESSAGES.serverUnavailable,
      },
      503,
      true,
      "server",
    );
  }

  const method = options.method ?? "GET";
  const shouldDedupe = options.dedupe ?? method === "GET";
  const token = options.skipAuth
    ? null
    : await resolveAccessToken(options.token);
  const url = joinApiUrl(path);
  const key = dedupeKey(method, url, options.body, token);

  if (shouldDedupe) {
    const existing = inFlight.get(key);
    if (existing) {
      return existing as Promise<z.infer<TSchema>>;
    }
  }

  const requestPromise = executeRequest(path, options, token, false);

  if (shouldDedupe) {
    inFlight.set(key, requestPromise);
    try {
      return await requestPromise;
    } finally {
      inFlight.delete(key);
    }
  }

  return requestPromise;
}
