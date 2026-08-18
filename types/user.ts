import { z } from "zod";

export const backendRoleSchema = z.enum(["USER", "AGENT", "ADMIN"]);

export const backendUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    role: backendRoleSchema,
    accountType: z.enum(["ADULT", "CHILD"]).nullish(),
    isEmailVerified: z.boolean().nullish(),
    familyId: z.string().nullable().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  })
  .strip();

export type BackendUser = z.infer<typeof backendUserSchema>;
export type BackendRole = z.infer<typeof backendRoleSchema>;

/** @deprecated Prefer BackendUser — kept as alias during UI migration */
export type AgentUser = BackendUser;
export const agentUserSchema = backendUserSchema;

export function formatAgentName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "Agent",
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || fallback;
}

export function getAgentDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}): string {
  return formatAgentName(user.firstName, user.lastName, user.email ?? "Agent");
}
