import { NextResponse } from "next/server";
import { logAuthEvent } from "@/lib/auth/audit-log";
import { destroySession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";

export async function GET(request: Request) {
  await destroySession();
  const reason = new URL(request.url).searchParams.get("reason") ?? "session";
  logAuthEvent(
    reason === "expired" ? "session_expired" : "unauthorized_access",
    { reason },
  );

  const loginUrl = new URL(ROUTES.login, request.url);
  if (reason === "expired") {
    loginUrl.searchParams.set("expired", "1");
  }
  return NextResponse.redirect(loginUrl);
}
