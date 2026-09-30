import { NextResponse } from "next/server";
import { authApi } from "@/lib/api/auth";
import { logAuthEvent } from "@/lib/auth/audit-log";
import { destroySession, getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";

/** Full-page logout. A server-action redirect fights the login guard and crashes. */
export async function GET(request: Request) {
  const session = await getSession();
  logAuthEvent("logout", { email: session?.user.email });

  if (session?.refreshToken) {
    await authApi.logout(session.refreshToken);
  }

  await destroySession();
  return NextResponse.redirect(new URL(ROUTES.login, request.url));
}
