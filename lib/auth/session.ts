import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/constants/routes";
import {
  sessionPayloadSchema,
  type SessionPayload,
} from "@/types/auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function encodeSession(session: SessionPayload): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decodeSession(value: string): SessionPayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = sessionPayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createSession(session: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const maxAge =
    session.expiresAt != null
      ? Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
      : SESSION_MAX_AGE_SECONDS;

  cookieStore.set(AUTH_COOKIE_NAME, encodeSession(session), {
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

  if (!raw) {
    return null;
  }

  const session = decodeSession(raw);

  if (!session) {
    return null;
  }

  if (session.expiresAt != null && session.expiresAt < Date.now()) {
    await destroySession();
    return null;
  }

  return session;
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
