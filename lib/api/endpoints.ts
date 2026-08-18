import { API_PATHS } from "@/lib/config/api-paths";

/** Live Agent Backend routes. Always joined with env.apiBaseUrl (/api/v1). */
export const API_ENDPOINTS = {
  auth: {
    agentLogin: API_PATHS.auth.agentLogin,
  },
  agents: {
    me: API_PATHS.agents.me,
    changePassword: API_PATHS.agents.changePassword,
  },
} as const;
