import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { apiErrorBodySchema } from "@/lib/api/schemas/envelope";
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
};

const inFlight = new Map<string, Promise<unknown>>();

function statusToCode(status: number): ApiErrorBody["code"] {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "VALIDATION_ERROR";
}

function dedupeKey(
  method: HttpMethod,
  url: string,
  body: unknown,
  token: string | null,
): string {
  return `${method}:${url}:${token ?? ""}:${body ? JSON.stringify(body) : ""}`;
}

function parseValidatedData<TSchema extends z.ZodTypeAny>(
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

  if (record.success === false) {
    const errorParsed = apiErrorBodySchema.safeParse(record.error);
    throw new ApiError(
      errorParsed.success
        ? errorParsed.data
        : {
            code: statusToCode(httpStatus),
            message: "Request failed.",
          },
      httpStatus,
    );
  }

  if (record.success !== true) {
    throw new ApiError(
      {
        code: "SERVER_ERROR",
        message: "Backend response missing success flag.",
      },
      httpStatus || 502,
      false,
    );
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

  if (!httpStatus || httpStatus >= 400) {
    throw new ApiError(
      {
        code: statusToCode(httpStatus),
        message: "Request failed.",
      },
      httpStatus,
    );
  }

  return dataParsed.data;
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
  const url = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const token = options.skipAuth
    ? null
    : await resolveAccessToken(options.token);

  const key = dedupeKey(method, url, options.body, token);

  if (shouldDedupe) {
    const existing = inFlight.get(key);
    if (existing) {
      return existing as Promise<z.infer<TSchema>>;
    }
  }

  const requestPromise = (async () => {
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
          message:
            "Network request failed. Check your connection and try again.",
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

    return parseValidatedData(raw, options.schema, response.status);
  })();

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
