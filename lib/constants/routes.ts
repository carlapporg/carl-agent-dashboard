export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  tasks: "/tasks",
  task: (taskId: string) => `/tasks/${taskId}` as const,
  taskPayments: (taskId: string) => `/tasks/${taskId}/payments` as const,
  inbox: "/inbox",
  profile: "/profile",
  profileEdit: "/profile/edit",
  settings: "/settings",
  unauthorized: "/unauthorized",
  sessionClear: "/session/clear",
} as const;

export const PUBLIC_ROUTES = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.unauthorized,
] as const;

export const AUTH_COOKIE_NAME = "carl_agent_session";
