import type { LoginCredentials, LoginResponse } from "@/types/auth";
import type { AgentUser } from "@/types/user";

export function createMockLoginResponse(
  credentials: LoginCredentials,
): LoginResponse {
  const localPart = credentials.email.split("@")[0] || "agent";
  const name = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    accessToken: `stub_access_${Buffer.from(credentials.email).toString("base64url")}`,
    refreshToken: `stub_refresh_${Date.now()}`,
    expiresIn: 60 * 60 * 8,
    user: {
      id: "agent_stub_001",
      email: credentials.email,
      name: name || "Carl Agent",
      role: "agent",
      avatarUrl: null,
    },
  };
}

export const mockAgentUser: AgentUser = {
  id: "agent_stub_001",
  email: "agent@carl.app",
  name: "Alex Morgan",
  role: "agent",
  avatarUrl: null,
};
