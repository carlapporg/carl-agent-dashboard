import { z } from "zod";

export const agentRoleSchema = z.enum(["agent", "supervisor", "admin"]);

export const agentUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: agentRoleSchema,
  avatarUrl: z.string().url().nullable().optional(),
});

export type AgentUser = z.infer<typeof agentUserSchema>;
export type AgentRole = z.infer<typeof agentRoleSchema>;
