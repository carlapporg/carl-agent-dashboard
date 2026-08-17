export async function resolveAccessToken(
  explicitToken?: string | null,
): Promise<string | null> {
  if (explicitToken) {
    return explicitToken;
  }

  if (typeof window === "undefined") {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    return session?.accessToken ?? null;
  }

  return null;
}
