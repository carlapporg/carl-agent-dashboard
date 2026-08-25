type TokenListener = (token: string) => void;

const listeners = new Set<TokenListener>();

export function accessTokenFromUnknown(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  if (!("accessToken" in raw)) return null;
  const token = (raw as { accessToken: unknown }).accessToken;
  return typeof token === "string" && token ? token : null;
}

/** Tell live sockets when REST refresh gets a new access token. */
export function publishAccessToken(token: string) {
  if (!token) return;
  for (const listen of listeners) listen(token);
}

export function subscribeAccessToken(listen: TokenListener): () => void {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}
