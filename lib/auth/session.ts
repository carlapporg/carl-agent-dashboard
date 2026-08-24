import { cookies, headers } from "next/headers";
import {
  ACCESS_TOKEN_REQUEST_HEADER,
  encodeSessionCookie,
  parseSessionCookie,
  sessionCookieSetOptions,
} from "@/lib/auth/session-cookie";
import { AUTH_COOKIE_NAME } from "@/lib/constants/routes";
import type { SessionPayload } from "@/types/auth";
import type { BackendUser } from "@/types/user";

export async function createSession(session: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_COOKIE_NAME,
    encodeSessionCookie(session),
    sessionCookieSetOptions(session.rememberMe),
  );
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionCookie(raw);
  if (!session) return null;

  try {
    const headerStore = await headers();
    const overlay = headerStore.get(ACCESS_TOKEN_REQUEST_HEADER);
    if (overlay) {
      return { ...session, accessToken: overlay };
    }
  } catch {
    /* headers() unavailable outside a request */
  }

  return session;
}

export async function updateSessionTokens(
  accessToken: string,
  refreshToken?: string | null,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await createSession({
    ...session,
    accessToken,
    refreshToken: refreshToken || session.refreshToken,
  });
}

export async function updateSessionUser(user: BackendUser): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await createSession({
    ...session,
    user,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
