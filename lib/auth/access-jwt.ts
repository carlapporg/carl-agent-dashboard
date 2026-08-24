/** Edge-safe JWT expiry check. Access tokens are JWTs; refresh tokens are opaque. */

const SKEW_MS = 90_000;

export function isAccessTokenExpiredOrStale(token: string, now = Date.now()): boolean {
  const expMs = readJwtExpiryMs(token);
  if (expMs == null) return false;
  return expMs <= now + SKEW_MS;
}

export function readJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (payload.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(payload)
        : Buffer.from(payload, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const exp = (parsed as { exp?: unknown }).exp;
    if (typeof exp !== "number") return null;
    return exp * 1000;
  } catch {
    return null;
  }
}
