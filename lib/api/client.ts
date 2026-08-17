import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import {
  nestErrorSchema,
  nestMessageToString,
} from "@/lib/api/schemas/envelope";
import { resolveAccessToken } from "@/lib/api/token";
import { env } from "@/lib/config/env";
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
};

const inFlight = new Map<string, Promise<unknown>>();
let refreshPromise: Promise<string | null> | null = null;

function statusToCode(status: number): ApiErrorBody["code"] {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "VALIDATION_ERROR";
}

function calmMessageForStatus(
  status: number,
  rawMessage: string,
  errorLabel?: string,
): string {
  const upper = `${rawMessage} ${errorLabel ?? ""}`.toUpperCase();
  if (status === 401) {
    if (upper.includes("CREDENTIAL")) {
      return "Incorrect email or password.";
    }
    return "Incorrect email or password.";
  }
  if (status === 403) {
    if (upper.includes("EMAIL_NOT_VERIFIED") || upper.includes("VERIFIED")) {
      return "Please verify your email before signing in.";
    }
    if (upper.includes("WRONG_ROLE") || upper.includes("ROLE")) {
      return "This account is not an agent account.";
    }
    return "You don’t have access to do that.";
  }
  if (status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (status === 0) {
    return "Network request failed. Check your connection and try again.";
  }
  if (status >= 500) {
    return "Something went wrong on our side. Please try again.";
  }
  return rawMessage || "Request failed.";
}

function dedupeKey(
  method: HttpMethod,
  url: string,
  body: unknown,
  token: string | null,
): string {
  return `${method}:${url}:${token ?? ""}:${body ? JSON.stringify(body) : ""}`;
}

function throwFromNestError(raw: unknown, httpStatus: number): never {
  const parsed = nestErrorSchema.safeParse(raw);
  const status = parsed.success
    ? (parsed.data.statusCode ?? httpStatus)
    : httpStatus;
  const rawMessage = nestMessageToString(
    parsed.success ? parsed.data.message : undefined,
    "Request failed.",
  );
  throw new ApiError(
    {
      code: statusToCode(status),
      message: calmMessageForStatus(
        status,
        rawMessage,
        parsed.success ? parsed.data.error : undefined,
      ),
    },
    status,
    status === 429 || status >= 500,
  );
}

function parseSuccessData<TSchema extends z.ZodTypeAny>(
  raw: unknown,
  dataSchema: TSchema,
  httpStatus: number,
): z.infer<TSchema> {
  if (!raw || typeof raw !== "object") {
    throw new ApiError(
      {
        code: "SERVER_ERROR",
        message: "Backend response failed contract validation.",
      },
      httpStatus || 502,
      false,
    );
  }

  const record = raw as Record<string, unknown>;

  if (!("data" in record)) {
    throwFromNestError(raw, httpStatus);
  }

  const dataParsed = dataSchema.safeParse(record.data);
  if (!dataParsed.success) {
    throw new ApiError(
      {
        code: "SERVER_ERROR",
        message: "Backend response failed contract validation.",
        details: {
          zod: dataParsed.error.issues.map(
            (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
          ),
        },
      },
      httpStatus || 502,
      false,
    );
  }

  return dataParsed.data;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { getSession, updateSessionTokens } = await import(
          "@/lib/auth/session"
        );
        const session = await getSession();
        if (!session?.refreshToken) return null;

        const url = `${env.apiBaseUrl}/auth/refresh`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
          cache: "no-store",
        });

        const raw: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          return null;
        }

        const pair = z
          .object({
            data: z.object({
              accessToken: z.string().min(1),
              refreshToken: z.string().min(1),
            }),
          })
          .safeParse(raw);

        if (!pair.success) return null;

        await updateSessionTokens(
          pair.data.data.accessToken,
          pair.data.data.refreshToken,
        );
        return pair.data.data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function executeRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: ApiRequestOptions<TSchema>,
  token: string | null,
  hasRetried: boolean,
): Promise<z.infer<TSchema>> {
  const method = options.method ?? "GET";
  const url = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: options.signal,
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
    throw new ApiError(
      {
        code: "NETWORK_ERROR",
        message: calmMessageForStatus(0, "Network request failed."),
      },
      0,
      true,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new ApiError(
      {
        code: "SERVER_ERROR",
        message: "Received an invalid (non-JSON) response from the server.",
      },
      response.status,
      response.status >= 500,
    );
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
  }

  if (!response.ok) {
    throwFromNestError(raw, response.status);
  }

  return parseSuccessData(raw, options.schema, response.status);
}

export async function apiRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: ApiRequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  if (!env.isApiConfigured) {
    throw new ApiError(
      {
        code: "NOT_CONFIGURED",
        message:
          "API base URL is not configured. Set API_BASE_URL to use the real Backend, or call through mock-aware API modules.",
      },
      503,
      false,
    );
  }

  const method = options.method ?? "GET";
  const shouldDedupe = options.dedupe ?? method === "GET";
  const token = options.skipAuth
    ? null
    : await resolveAccessToken(options.token);
  const url = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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
