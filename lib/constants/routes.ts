export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  tasks: "/tasks",
  task: (taskId: string) => `/tasks/${taskId}` as const,
  taskPayments: (taskId: string) => `/tasks/${taskId}/payments` as const,
  /** Deep-link helper: panel = payment | chat | brief | log */
  taskPanel: (taskId: string, panel: string) =>
    `/tasks/${taskId}?panel=${encodeURIComponent(panel)}` as const,
  inbox: "/inbox",
  messages: "/messages",
  adminChat: "/admin-chat",
  payments: "/payments",
  history: "/history",
  notifications: "/notifications",
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
