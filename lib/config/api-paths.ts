function path(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/^\/api\/v1(?=\/|$)/, "") || fallback;
}

/**
 * Live Backend paths only. Prefix /api/v1 is added by env.apiBaseUrl / joinApiUrl.
 * Do not put /api/v1 in these values.
 */
export const API_PATHS = {
  auth: {
    agentLogin: path(process.env.API_AUTH_AGENT_LOGIN, "/auth/agent/login"),
  },
  agents: {
    me: path(process.env.API_AGENTS_ME, "/agents/me"),
    changePassword: path(
      process.env.API_AGENTS_CHANGE_PASSWORD,
      "/agents/me/change-password",
    ),
  },
} as const;
