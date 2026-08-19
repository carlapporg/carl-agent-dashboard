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

function redirectToLogin(request: NextRequest, pathname: string) {
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

  if (rawCookie && !hasValidSession) {
    return redirectToLogin(request, pathname);
  }

  const isLoginRoute =
    pathname === ROUTES.login || pathname.startsWith(`${ROUTES.login}/`);
  const isRegisterRoute =
    pathname === ROUTES.register || pathname.startsWith(`${ROUTES.register}/`);
  const isAuthRoute = isLoginRoute || isRegisterRoute;
  const isUnauthorizedRoute = pathname.startsWith(ROUTES.unauthorized);
  const isProtectedRoute =
    pathname === ROUTES.home ||
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (isProtectedRoute && !hasValidSession) {
    return redirectToLogin(request, pathname);
  }

  if (isAuthRoute && hasValidSession) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  if (isUnauthorizedRoute && hasValidSession) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
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
