function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return "invalid-email";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

type AuthLogEvent =
  | "login_success"
  | "login_failed"
  | "logout"
  | "unauthorized_access"
  | "session_expired";

/**
 * Auth audit log — never include passwords or tokens.
 */
export function logAuthEvent(
  event: AuthLogEvent,
  details: {
    email?: string;
    reason?: string;
    status?: number;
  } = {},
): void {
  console.info("[auth]", event, {
    email: details.email ? maskEmail(details.email) : undefined,
    reason: details.reason,
    status: details.status,
  });
}
