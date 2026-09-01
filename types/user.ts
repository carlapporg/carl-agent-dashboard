import { z } from "zod";

export const backendRoleSchema = z.enum(["USER", "AGENT", "ADMIN"]);

export const backendUserSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    accountType: o.accountType ?? o.accountType,
    isEmailVerified: o.isEmailVerified ?? o.isEmailVerified,
    familyId: o.familyId ?? o.familyId,
    avatarUrl:
      typeof o.avatarUrl === "string" && o.avatarUrl.trim()
        ? o.avatarUrl.trim()
        : null,
  };
}, z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    role: backendRoleSchema,
    accountType: z.enum(["ADULT", "CHILD"]).nullish(),
    authProvider: z.string().nullish(),
    isEmailVerified: z.boolean().nullish(),
    familyId: z.string().nullable().nullish(),
    avatarUrl: z.string().min(1).nullable().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  })
  .strip());

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

export function getAgentInitials(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}): string {
  const first = user.firstName?.trim()?.[0]?.toUpperCase() ?? "";
  const last = user.lastName?.trim()?.[0]?.toUpperCase() ?? "";
  if (first || last) return `${first}${last}` || "A";
  const email = user.email?.trim()?.[0]?.toUpperCase();
  return email || "A";
}
