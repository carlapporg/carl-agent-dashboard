export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  tasks: "/tasks",
  task: (taskId: string) => `/tasks/${taskId}` as const,
  taskPayments: (taskId: string) => `/tasks/${taskId}/payments` as const,
  inbox: "/inbox",
  profile: "/profile",
  settings: "/settings",
  unauthorized: "/unauthorized",
} as const;

export const PUBLIC_ROUTES = [ROUTES.login, ROUTES.unauthorized] as const;

export const AUTH_COOKIE_NAME = "carl_agent_session";
