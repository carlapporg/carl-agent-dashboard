function readFlag(value: string | undefined): boolean {
  if (value == null || value === "") return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function trimBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

/** Ensures the host includes /api/v1 exactly once. */
function withApiVersionPrefix(base: string): string {
  const trimmed = trimBaseUrl(base);
  if (!trimmed) return "";
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

const apiBaseUrl = withApiVersionPrefix(
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "",
);
const apiDocsUrl = trimBaseUrl(process.env.API_DOCS_URL);
const wsUrl = trimBaseUrl(process.env.NEXT_PUBLIC_WS_URL);
const isApiConfigured = Boolean(apiBaseUrl);
const authStubMode = readFlag(process.env.AUTH_STUB_MODE) || !isApiConfigured;

export const env = {
  apiBaseUrl,
  apiDocsUrl,
  /** Browser-visible WS URL when set (native WebSocket, not Socket.IO). */
  wsUrl,
  isProduction: process.env.NODE_ENV === "production",
  isApiConfigured,
  authStubMode,
} as const;
