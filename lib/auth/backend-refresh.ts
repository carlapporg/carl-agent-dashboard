import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";

export type RefreshOutcome =
  | { ok: true; accessToken: string; refreshToken: string | null }
  | { ok: false; reason: "invalid" | "network" };

function joinUrl(path: string): string {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function parseTokenPair(raw: unknown): RefreshOutcome | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const accessToken =
    typeof data.accessToken === "string" ? data.accessToken : null;
  if (!accessToken) return null;
  const refreshToken =
    typeof data.refreshToken === "string" ? data.refreshToken : null;
  return { ok: true, accessToken, refreshToken };
}

function failedStatusReason(status: number): "invalid" | "network" {
  if (status === 400 || status === 401 || status === 403) return "invalid";
  return "network";
}

function ngrokHeaders(url: string): Record<string, string> {
  return /ngrok/i.test(url)
    ? { "ngrok-skip-browser-warning": "1" }
    : {};
}

/**
 * Calls Nest POST /auth/refresh. Does not touch cookies.
 * `invalid` = refresh token is dead. `network` = tunnel/server unreachable.
 */
export async function refreshBackendTokens(
  refreshToken: string,
): Promise<RefreshOutcome> {
  const url = joinUrl(API_ENDPOINTS.auth.refresh);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...ngrokHeaders(url),
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) {
    return { ok: false, reason: failedStatusReason(response.status) };
  }

  return parseTokenPair(raw) ?? { ok: false, reason: "network" };
}
