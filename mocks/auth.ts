import type { LoginCredentials, LoginResponse, RegisterCredentials } from "@/types/auth";
import type { BackendUser } from "@/types/user";

export function createMockRegisterResponse(
  credentials: RegisterCredentials,
): BackendUser {
  const login = createMockLoginResponse({
    email: credentials.email,
    password: credentials.password,
  });

  return {
    ...login.user,
    firstName: credentials.firstName,
    lastName: credentials.lastName ?? null,
    isEmailVerified: true,
  };
}

export function createMockLoginResponse(
  credentials: LoginCredentials,
): LoginResponse {
  const localPart = credentials.email.split("@")[0] || "agent";
  const parts = localPart.replace(/[._-]+/g, " ").split(" ");
  const firstName =
    parts[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) || "Alex";
  const lastName =
    parts.slice(1).join(" ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Morgan";

  return {
    accessToken: `stub_access_${Buffer.from(credentials.email).toString("base64url")}`,
    refreshToken: `stub_refresh_${Date.now()}`,
    user: {
      id: "agent_stub_001",
      email: credentials.email,
      firstName,
      lastName,
      role: "AGENT",
      accountType: "ADULT",
      isEmailVerified: true,
      familyId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export const mockAgentUser: BackendUser = {
  id: "agent_stub_001",
  email: "agent@carl.app",
  firstName: "Alex",
  lastName: "Morgan",
  role: "AGENT",
  accountType: "ADULT",
  isEmailVerified: true,
  familyId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
