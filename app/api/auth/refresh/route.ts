import { NextResponse } from "next/server";
import { refreshBackendTokens } from "@/lib/auth/backend-refresh";
import { destroySession, getSession, updateSessionTokens } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (!session?.refreshToken) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 401 });
  }

  const result = await refreshBackendTokens(session.refreshToken);
  if (!result.ok) {
    if (result.reason === "network") {
      return NextResponse.json(
        { ok: false, reason: "network" },
        { status: 503 },
      );
    }
    await destroySession();
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 401 });
  }

  await updateSessionTokens(result.accessToken, result.refreshToken);
  return NextResponse.json({
    ok: true,
    accessToken: result.accessToken,
  });
}
