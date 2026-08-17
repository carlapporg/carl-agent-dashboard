function readFlag(value: string | undefined): boolean {
  if (value == null || value === "") return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

const apiBaseUrl = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");

const isApiConfigured = Boolean(apiBaseUrl);

const authStubMode =
  readFlag(process.env.AUTH_STUB_MODE) || !isApiConfigured;

export const env = {
  apiBaseUrl,
  isProduction: process.env.NODE_ENV === "production",
  isApiConfigured,
  authStubMode,
} as const;
