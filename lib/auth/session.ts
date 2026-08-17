import { cookies } from "next/headers";
import {
  encodeSessionCookie,
  parseSessionCookie,
} from "@/lib/auth/session-cookie";
import { AUTH_COOKIE_NAME } from "@/lib/constants/routes";
import type { SessionPayload } from "@/types/auth";
import type { BackendUser } from "@/types/user";

const SESSION_MAX_AGE_DEFAULT = 60 * 60 * 24; // 1 day
const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30 days

export async function createSession(session: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = session.rememberMe
    ? SESSION_MAX_AGE_REMEMBER
    : SESSION_MAX_AGE_DEFAULT;

  cookieStore.set(AUTH_COOKIE_NAME, encodeSessionCookie(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return parseSessionCookie(raw);
}

export async function updateSessionTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await createSession({
    ...session,
    accessToken,
    refreshToken,
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
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
