export const USER_MESSAGES = {
  emailRequired: "Please enter your email address",
  emailInvalid: "Please enter a valid email address",
  passwordRequired: "Please enter your password",
  passwordMinLength: "Password must be at least 8 characters",
  passwordMismatch: "Passwords do not match",
  firstNameRequired: "Please enter your first name",
  emailTaken: "An account with this email already exists.",
  registerSuccess: "Account created successfully.",
  invalidCredentials: "Invalid email or password",
  unauthorizedApp: "You are not authorized to access this application",
  offerGone: "This offer expired or went to another agent.",
  offerAlreadyAccepted: "This task was already accepted.",
  rejectWindowEnded: "The reject window ended. This task will be accepted.",
  taskGone: "This task isn't yours anymore. Refresh to see your current list.",
  accountDisabled: "Your account has been disabled. Please contact support.",
  network:
    "Unable to connect to server. Please check your internet connection and try again.",
  serverUnavailable: "Server is temporarily unavailable. Please try again later.",
  unknown: "Something went wrong. Please try again.",
  apiNotConfigured:
    "This deployment is missing API_BASE_URL. Add it in Vercel → Settings → Environment Variables, then redeploy.",
  rateLimited: "Too many attempts. Please wait a moment and try again.",
  sessionExpired: "Your session expired. Please sign in again.",
  wrongPassword: "Current password is incorrect.",
} as const;

export type AuthErrorKind =
  | "credentials"
  | "forbidden"
  | "disabled"
  | "conflict"
  | "rate_limit"
  | "network"
  | "server"
  | "session"
  | "wrong_password"
  | "unknown";

function combinedInternalText(
  message: string | string[] | undefined,
  errorLabel?: string,
): string {
  const fromMessage = Array.isArray(message)
    ? message.join(" ")
    : (message ?? "");
  return `${fromMessage} ${errorLabel ?? ""}`.toUpperCase();
}

export function classifyAuthError(
  status: number,
  internalMessage?: string | string[],
  errorLabel?: string,
  context: "login" | "api" | "password" = "api",
): AuthErrorKind {
  if (status === 0) return "network";
  if (status === 429) return "rate_limit";
  if (status === 409) return "conflict";
  if (status === 503 || status === 502 || status === 500 || status >= 500) {
    return "server";
  }

  const text = combinedInternalText(internalMessage, errorLabel);

  if (
    text.includes("DISABLED") ||
    text.includes("INACTIVE") ||
    text.includes("SUSPENDED") ||
    text.includes("DEACTIVATED")
  ) {
    return "disabled";
  }

  if (status === 403) {
    if (text.includes("WRONG_ROLE") || text.includes("ROLE")) {
      return "forbidden";
    }
    if (text.includes("EMAIL_NOT_VERIFIED") || text.includes("VERIFIED")) {
      return "forbidden";
    }
    return "forbidden";
  }

  if (status === 401) {
    if (context === "login") return "credentials";
    if (context === "password") return "wrong_password";
    return "session";
  }

  // Nest validation / bad request during login → treat as credentials
  if (status === 400 && context === "login") {
    return "credentials";
  }

  return "unknown";
}

export function messageForKind(kind: AuthErrorKind): string {
  switch (kind) {
    case "credentials":
      return USER_MESSAGES.invalidCredentials;
    case "forbidden":
      return USER_MESSAGES.unauthorizedApp;
    case "disabled":
      return USER_MESSAGES.accountDisabled;
    case "conflict":
      return USER_MESSAGES.emailTaken;
    case "rate_limit":
      return USER_MESSAGES.rateLimited;
    case "network":
      return USER_MESSAGES.network;
    case "server":
      return USER_MESSAGES.serverUnavailable;
    case "session":
      return USER_MESSAGES.sessionExpired;
    case "wrong_password":
      return USER_MESSAGES.wrongPassword;
    default:
      return USER_MESSAGES.unknown;
  }
}
