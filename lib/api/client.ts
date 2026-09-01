import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import {
  classifyAuthError,
  messageForKind,
  USER_MESSAGES,
} from "@/lib/api/public-messages";
import {
  nestErrorSchema,
  nestMessageToString,
} from "@/lib/api/schemas/envelope";
import { env } from "@/lib/config/env";
import { resolveAccessToken } from "@/lib/api/token";
import {
  accessTokenFromUnknown,
  publishAccessToken,
} from "@/lib/auth/access-token-bus";
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
  /** Accept `{ data }` or a raw array/object body (list endpoints). */
  looseEnvelope?: boolean;
  /** Override the default request timeout. */
  timeoutMs?: number;
};

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;
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

export function joinApiUrl(path: string): string {
  const base = env.apiBaseUrl;
  let suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix === "/api/v1") suffix = "/";
  if (suffix.startsWith("/api/v1/")) {
    suffix = suffix.slice("/api/v1".length);
  }
  return `${base}${suffix}`;
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function dedupeKey(
  method: HttpMethod,
  url: string,
  body: unknown,
  token: string | null,
): string {
  if (isFormDataBody(body)) {
    return `${method}:${url}:${token ?? ""}:form`;
  }
  return `${method}:${url}:${token ?? ""}:${body ? JSON.stringify(body) : ""}`;
}

function isAgentSafeMessage(text: string): boolean {
  if (!text || text.length > 180) return false;
  return !/(PRISMA|ECONN|ENOENT|SQLSTATE|EXCEPTION|STACK TRACE)/i.test(text);
}

function throwMappedError(
  status: number,
  internalMessage?: string | string[],
  errorLabel?: string,
  context: "login" | "api" | "password" = "api",
): never {
  const kind = classifyAuthError(status, internalMessage, errorLabel, context);
  const nestText = nestMessageToString(internalMessage, "");
  const message =
    context === "api" && kind === "unknown" && isAgentSafeMessage(nestText)
      ? nestText
      : messageForKind(kind);
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
  looseEnvelope = false,
): z.infer<TSchema> {
  if (looseEnvelope) {
    if (raw && typeof raw === "object" && "data" in raw) {
      const wrapped = dataSchema.safeParse((raw as { data: unknown }).data);
      if (wrapped.success) return wrapped.data;
    }
    const direct = dataSchema.safeParse(raw);
    if (direct.success) return direct.data;
  }

  if (!raw || typeof raw !== "object") {
    throwMappedError(httpStatus || 502, undefined, undefined, context);
  }

  const record = raw as Record<string, unknown>;

  if (!("data" in record)) {
    const direct = dataSchema.safeParse(raw);
    if (direct.success) return direct.data;
    throwMappedError(httpStatus || 502, undefined, undefined, context);
  }

  const dataParsed = dataSchema.safeParse(record.data);
  if (!dataParsed.success) {
    throwMappedError(httpStatus || 502, undefined, undefined, context);
  }

  return dataParsed.data;
}

let memoryAccessToken: string | null = null;
let refreshInFlight: Promise<RefreshAttempt> | null = null;

export function clearServerAccessTokenMemory() {
  memoryAccessToken = null;
}

export function rememberAccessToken(token: string) {
  if (!token) return;
  memoryAccessToken = token;
  publishAccessToken(token);
}

type RefreshAttempt =
  | { ok: true; token: string }
  | { ok: false; reason: "invalid" | "network" };

async function tryRefreshAccessToken(): Promise<RefreshAttempt> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAccessTokenOnce().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshAccessTokenOnce(): Promise<RefreshAttempt> {
  if (typeof window !== "undefined") {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      });
      if (response.status === 503) return { ok: false, reason: "network" };
      if (!response.ok) return { ok: false, reason: "invalid" };
      const raw: unknown = await response.json();
      const accessToken = accessTokenFromUnknown(raw);
      if (!accessToken) return { ok: false, reason: "network" };
      rememberAccessToken(accessToken);
      return { ok: true, token: accessToken };
    } catch {
      return { ok: false, reason: "network" };
    }
  }

  const { getSession } = await import("@/lib/auth/session");
  const { refreshSessionAccessToken } = await import(
    "@/lib/auth/refresh-session"
  );
  const session = await getSession();
  if (!session?.refreshToken) return { ok: false, reason: "invalid" };
  const result = await refreshSessionAccessToken(session.refreshToken);
  if (!result.ok) return result;
  rememberAccessToken(result.accessToken);
  return { ok: true, token: result.accessToken };
}

function combineSignals(
  extra: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (extra && typeof AbortSignal.any === "function") {
    return AbortSignal.any([extra, timeout]);
  }
  return timeout;
}

function nestHeaders(
  url: string,
  token: string | null,
  extra?: HeadersInit,
  jsonBody = false,
): HeadersInit {
  return {
    Accept: jsonBody ? "application/json" : "*/*",
    ...(jsonBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(/ngrok/i.test(url) ? { "ngrok-skip-browser-warning": "1" } : {}),
    ...extra,
  };
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
  const form = isFormDataBody(options.body);
  const timeoutMs =
    options.timeoutMs ?? (form ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  const signal = combineSignals(options.signal, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: nestHeaders(
        url,
        token,
        options.headers,
        Boolean(options.body) && !form,
      ),
      body: form
        ? (options.body as FormData)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
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
    const refreshed = await tryRefreshAccessToken();
    if (refreshed.ok) {
      rememberAccessToken(refreshed.token);
      return executeRequest(path, options, refreshed.token, true);
    }
    if (refreshed.reason === "network") {
      throwMappedError(0, undefined, undefined, context);
    }
    if (typeof window !== "undefined") {
      window.location.assign("/session/clear?reason=expired");
    }
    throwMappedError(401, undefined, undefined, "api");
  }

  if (!response.ok) {
    throwFromNestError(raw, response.status, context);
  }

  return parseSuccessData(
    raw,
    options.schema,
    response.status,
    context,
    options.looseEnvelope,
  );
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
  const shouldDedupe =
    (options.dedupe ?? method === "GET") && !isFormDataBody(options.body);
  const token = options.skipAuth
    ? null
    : options.token ??
      (typeof window !== "undefined" ? memoryAccessToken : null) ??
      (await resolveAccessToken(options.token));
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

type NestFetchInit = {
  method?: HttpMethod;
  body?: BodyInit | null;
  headers?: HeadersInit;
  timeoutMs?: number;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  token?: string | null;
};

async function nestFetchOnce(
  path: string,
  init: NestFetchInit,
  token: string | null,
  hasRetried: boolean,
): Promise<Response> {
  const method = init.method ?? "GET";
  const url = joinApiUrl(path);
  const timeoutMs = init.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const signal = combineSignals(undefined, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: nestHeaders(url, token, init.headers, false),
      body: init.body ?? undefined,
      cache: "no-store",
    });
  } catch {
    throwMappedError(0, undefined, undefined, "api");
  }

  if (
    response.status === 401 &&
    !init.skipAuth &&
    !init.skipRefresh &&
    !hasRetried
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed.ok) {
      rememberAccessToken(refreshed.token);
      return nestFetchOnce(path, init, refreshed.token, true);
    }
    if (refreshed.reason === "network") {
      throwMappedError(0, undefined, undefined, "api");
    }
    if (typeof window !== "undefined") {
      window.location.assign("/session/clear?reason=expired");
    }
    throwMappedError(401, undefined, undefined, "api");
  }

  return response;
}

/** Raw Nest fetch for binary streams (audio / image). */
export async function nestFetch(
  path: string,
  init: NestFetchInit = {},
): Promise<Response> {
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

  const token = init.skipAuth
    ? null
    : init.token ??
      (typeof window !== "undefined" ? memoryAccessToken : null) ??
      (await resolveAccessToken(init.token));

  return nestFetchOnce(path, init, token, false);
}
