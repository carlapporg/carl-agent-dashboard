import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, ROUTES } from "@/lib/constants/routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isLoginRoute =
    pathname === ROUTES.login || pathname.startsWith(`${ROUTES.login}/`);
  const isForgotRoute =
    pathname === ROUTES.forgotPassword ||
    pathname.startsWith(`${ROUTES.forgotPassword}/`);
  const isUnauthorizedRoute = pathname.startsWith(ROUTES.unauthorized);
  const isPublicAuthRoute = isLoginRoute || isForgotRoute;
  const isProtectedRoute =
    pathname.startsWith(ROUTES.dashboard) || pathname === ROUTES.home;

  if (isProtectedRoute && !hasSession) {
    if (pathname.startsWith(ROUTES.dashboard)) {
      return NextResponse.redirect(new URL(ROUTES.unauthorized, request.url));
    }
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((isPublicAuthRoute || isUnauthorizedRoute) && hasSession) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/forgot-password",
    "/unauthorized",
    "/dashboard/:path*",
  ],
};
