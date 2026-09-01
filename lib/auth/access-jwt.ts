/** Edge-safe JWT expiry check. Access tokens are JWTs; refresh tokens are opaque. */

const SKEW_MS = 90_000;

function readJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (payload.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(payload + pad)
        : Buffer.from(payload, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readJwtSubjectId(token: string): string | null {
  const payload = readJwtPayload(token);
  if (!payload) return null;
  for (const key of ["sub", "userId", "id"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function isAccessTokenExpiredOrStale(token: string, now = Date.now()): boolean {
  const expMs = readJwtExpiryMs(token);
  if (expMs == null) return false;
  return expMs <= now + SKEW_MS;
}

export function readJwtExpiryMs(token: string): number | null {
  const parsed = readJwtPayload(token);
  if (!parsed) return null;
  const exp = parsed.exp;
  if (typeof exp !== "number") return null;
  return exp * 1000;
}
