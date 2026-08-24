import { cache } from "react";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { mockAgentUser } from "@/mocks/auth";
import { messageDataSchema } from "@/types/auth";
import {
  agentPresenceStateSchema,
  agentSkillsStateSchema,
  type AgentPresenceWrite,
  type AgentPresenceState,
  type AgentSkillsState,
} from "@/types/agent";
import { backendUserSchema, type BackendUser } from "@/types/user";

const getAgentMe = cache(async (): Promise<BackendUser> => {
  if (!env.isApiConfigured) {
    return mockAgentUser;
  }

  return apiRequest(API_ENDPOINTS.agents.me, {
    method: "GET",
    schema: backendUserSchema,
  });
});

export const agentsApi = {
  me: getAgentMe,

  async updateMe(input: {
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<BackendUser> {
    if (!env.isApiConfigured) {
      return {
        ...mockAgentUser,
        firstName: input.firstName ?? mockAgentUser.firstName,
        lastName: input.lastName ?? mockAgentUser.lastName,
      };
    }

    return apiRequest(API_ENDPOINTS.agents.meUpdate, {
      method: "PATCH",
      body: input,
      schema: backendUserSchema,
      dedupe: false,
    });
  },

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    if (!env.isApiConfigured) {
      return {
        message: "Password changed successfully. Please log in again.",
      };
    }

    return apiRequest(API_ENDPOINTS.agents.changePassword, {
      method: "POST",
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
      schema: messageDataSchema,
      dedupe: false,
      authContext: "password",
    });
  },

  async getAvailability(): Promise<AgentPresenceState> {
    return apiRequest(API_ENDPOINTS.agents.availability, {
      method: "GET",
      schema: agentPresenceStateSchema,
    });
  },

  async setAvailability(status: AgentPresenceWrite): Promise<AgentPresenceState> {
    return apiRequest(API_ENDPOINTS.agents.availability, {
      method: "PATCH",
      body: { status },
      schema: agentPresenceStateSchema,
      dedupe: false,
    });
  },

  async getSkills(): Promise<AgentSkillsState> {
    return apiRequest(API_ENDPOINTS.agents.skills, {
      method: "GET",
      schema: agentSkillsStateSchema,
    });
  },

  async setSkills(input: {
    skills: string[];
    isGeneralist?: boolean;
  }): Promise<AgentSkillsState> {
    return apiRequest(API_ENDPOINTS.agents.skills, {
      method: "PATCH",
      body: {
        skills: input.skills,
        isGeneralist: input.isGeneralist ?? false,
      },
      schema: agentSkillsStateSchema,
      dedupe: false,
    });
  },
};
