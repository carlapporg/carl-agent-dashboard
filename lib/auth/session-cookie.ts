import {
  sessionPayloadSchema,
  type SessionPayload,
} from "@/types/auth";

/**
 * Cookie encode/decode helpers shared by server session + Edge proxy.
 * Keep this free of `next/headers` so proxy can import it.
 */

export const SESSION_MAX_AGE_DEFAULT = 60 * 60 * 24;
export const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30;
export const ACCESS_TOKEN_REQUEST_HEADER = "x-agent-access-token";
// Single name only — do not also export ACCESS_TOKEN_REQUEST_HEADER here.

export function sessionCookieMaxAge(rememberMe?: boolean): number {
  return rememberMe ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_DEFAULT;
}

export function sessionCookieSetOptions(rememberMe?: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionCookieMaxAge(rememberMe),
  };
}

export function encodeSessionCookie(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeSessionCookieJson(
  value: string,
): Record<string, unknown> | null {
  try {
    const json = base64UrlToUtf8(value);
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Same contract as `getSession()` — proxy must agree or redirects loop. */
export function parseSessionCookie(
  value: string | undefined,
): SessionPayload | null {
  if (!value) return null;
  const json = decodeSessionCookieJson(value);
  if (!json) return null;
  const parsed = sessionPayloadSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function isSessionCookieShapeValid(value: string | undefined): boolean {
  return parseSessionCookie(value) !== null;
}

function base64UrlToUtf8(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);

  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }

  return decodeURIComponent(
    Array.from(atob(base64), (char) => {
      const code = char.charCodeAt(0).toString(16).padStart(2, "0");
      return `%${code}`;
    }).join(""),
  );
}
