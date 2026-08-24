import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAccessTokenExpiredOrStale } from "@/lib/auth/access-jwt";
import { refreshBackendTokens } from "@/lib/auth/backend-refresh";
import {
  ACCESS_TOKEN_REQUEST_HEADER,
  encodeSessionCookie,
  isSessionCookieShapeValid,
  parseSessionCookie,
  sessionCookieSetOptions,
} from "@/lib/auth/session-cookie";
import { AUTH_COOKIE_NAME, ROUTES } from "@/lib/constants/routes";
import type { SessionPayload } from "@/types/auth";

const PROTECTED_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.tasks,
  ROUTES.inbox,
  ROUTES.messages,
  ROUTES.payments,
  ROUTES.history,
  ROUTES.notifications,
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

function applyRefreshedSession(
  request: NextRequest,
  session: SessionPayload,
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ACCESS_TOKEN_REQUEST_HEADER, session.accessToken);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.cookies.set(
    AUTH_COOKIE_NAME,
    encodeSessionCookie(session),
    sessionCookieSetOptions(session.rememberMe),
  );
  return response;
}

export async function proxy(request: NextRequest) {
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

  if (isProtectedRoute && rawCookie) {
    const session = parseSessionCookie(rawCookie);
    if (session && isAccessTokenExpiredOrStale(session.accessToken)) {
      const result = await refreshBackendTokens(session.refreshToken);
      if (result.ok) {
        return applyRefreshedSession(request, {
          ...session,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken || session.refreshToken,
        });
      }
      if (result.reason === "invalid") {
        return redirectToLogin(request, pathname);
      }
      // Tunnel/API down — keep the session. Do not force login.
    }
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
    "/messages",
    "/payments",
    "/history",
    "/notifications",
    "/profile",
    "/settings",
  ],
};
