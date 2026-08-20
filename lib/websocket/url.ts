/**
 * Resolve the native WebSocket URL.
 *
 * Prefer NEXT_PUBLIC_WS_URL (e.g. wss://api.example.com/ws).
 * If unset, derive from API_BASE_URL / NEXT_PUBLIC_API_BASE_URL by swapping
 * http(s) → ws(s) and appending /ws (placeholder path until backend is ready).
 */

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function httpToWs(url: string): string {
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
}

/** Strip trailing /api/v1 so WS can live at host root or /ws. */
function stripApiPrefix(url: string): string {
  return trimSlash(url).replace(/\/api\/v1$/i, "");
}

export function resolveWebSocketUrl(
  explicit?: string | null,
): string | null {
  const fromEnv =
    explicit?.trim() ||
    process.env.NEXT_PUBLIC_WS_URL?.trim() ||
    "";

  if (fromEnv) return trimSlash(fromEnv);

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    "";

  if (!apiBase) return null;

  const origin = stripApiPrefix(httpToWs(apiBase));
  if (!origin.startsWith("ws://") && !origin.startsWith("wss://")) return null;

  // Placeholder path — backend should document the final route.
  return `${origin}/ws`;
}

export function isWebSocketConfigured(): boolean {
  return Boolean(resolveWebSocketUrl());
}
