import { z } from "zod";

export const callTypeSchema = z.enum(["AUDIO", "VIDEO"]);
export const callStatusSchema = z.enum([
  "RINGING",
  "ACTIVE",
  "CONNECTED",
  "ENDED",
  "REJECTED",
  "TIMEOUT",
  "MISSED",
  "FAILED",
]);

export const livekitCredsSchema = z.object({
  token: z.string().min(1),
  url: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
});

export const callSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  type: callTypeSchema.default("AUDIO"),
  status: callStatusSchema,
  roomName: z.string().optional().nullable(),
  callerUserId: z.string().optional().nullable(),
  calleeUserId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  agentName: z.string().optional().nullable(),
  taskTitle: z.string().optional().nullable(),
  taskNumber: z.union([z.string(), z.number()]).optional().nullable(),
  livekit: livekitCredsSchema.optional().nullable(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
});

export type CallType = z.infer<typeof callTypeSchema>;
export type CallStatus = z.infer<typeof callStatusSchema>;
export type LivekitCreds = z.infer<typeof livekitCredsSchema>;
export type Call = z.infer<typeof callSchema>;

export type CallDirection = "incoming" | "outgoing";
