/**
 * All Backend API routes for the Agent Dashboard.
 *
 * Change paths here only. Full URL = API_BASE_URL + these paths.
 * Example: https://host/api/v1 + /auth/agent/login
 *
 * Do not put /api/v1 in these values — that prefix lives in API_BASE_URL.
 */
export const API_ENDPOINTS = {
  auth: {
    /** POST — agent sign-in */
    agentLogin: "/auth/agent/login",
    /** POST — agent self-registration */
    agentRegister: "/auth/agent/register",
  },
  agents: {
    /** GET current agent · PATCH update name */
    me: "/agents/me",
    /** POST change password */
    changePassword: "/agents/me/change-password",
  },
} as const;
