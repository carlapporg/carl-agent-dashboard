/**
 * Resolve the native WebSocket URL.
 *
 * Only NEXT_PUBLIC_WS_URL. Socket.IO is the live channel; do not guess /ws.
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

  // Do not invent `/ws` from the REST URL. Nest talks Socket.IO, not a
  // native WebSocket at /ws. Guessing that path causes reconnect storms
  // through ngrok and then REST calls fail with "Unable to connect".
  return null;
}

export function isWebSocketConfigured(): boolean {
  return Boolean(resolveWebSocketUrl());
}
