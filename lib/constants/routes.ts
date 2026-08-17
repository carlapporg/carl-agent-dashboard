export const ROUTES = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  dashboard: "/dashboard",
  unauthorized: "/unauthorized",
} as const;

export const PUBLIC_ROUTES = [
  ROUTES.login,
  ROUTES.forgotPassword,
  ROUTES.unauthorized,
] as const;

export const AUTH_COOKIE_NAME = "carl_agent_session";
