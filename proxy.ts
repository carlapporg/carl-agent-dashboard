import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSessionCookieShapeValid } from "@/lib/auth/session-cookie";
import { AUTH_COOKIE_NAME, ROUTES } from "@/lib/constants/routes";

const PROTECTED_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.tasks,
  ROUTES.inbox,
  ROUTES.profile,
  ROUTES.settings,
];

function clearSessionAndRedirect(request: NextRequest, pathname: string) {
  const loginUrl = new URL(ROUTES.login, request.url);
  if (pathname !== ROUTES.home && pathname !== ROUTES.login) {
    loginUrl.searchParams.set("next", pathname);
  }
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const hasValidSession = isSessionCookieShapeValid(rawCookie);

  // Stale/invalid cookie (e.g. pre–Plan 2 shape) must be cleared or we loop:
  // layout getSession()→null → /unauthorized → proxy sees cookie → /dashboard.
  if (rawCookie && !hasValidSession) {
    return clearSessionAndRedirect(request, pathname);
  }

  const isLoginRoute =
    pathname === ROUTES.login || pathname.startsWith(`${ROUTES.login}/`);
  const isUnauthorizedRoute = pathname.startsWith(ROUTES.unauthorized);
  const isProtectedRoute =
    pathname === ROUTES.home ||
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (isProtectedRoute && !hasValidSession) {
    if (pathname !== ROUTES.home) {
      return NextResponse.redirect(new URL(ROUTES.unauthorized, request.url));
    }
    return clearSessionAndRedirect(request, pathname);
  }

  if (isLoginRoute && hasValidSession) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  // Valid session on /unauthorized → dashboard. Invalid already cleared above.
  if (isUnauthorizedRoute && hasValidSession) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/unauthorized",
    "/dashboard",
    "/dashboard/:path*",
    "/tasks",
    "/tasks/:path*",
    "/inbox",
    "/profile",
    "/settings",
  ],
};
