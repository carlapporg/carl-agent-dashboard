import { z } from "zod";

export const callTypeSchema = z.enum(["AUDIO", "VIDEO"]);

const KNOWN_CALL_STATUSES = [
  "RINGING",
  "ACTIVE",
  "CONNECTED",
  "ACCEPTED",
  "ENDING",
  "ENDED",
  "REJECTED",
  "TIMEOUT",
  "MISSED",
  "FAILED",
  "BUSY",
] as const;

export const callStatusSchema = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim()) return "RINGING";
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}, z.string()).transform((value) => {
  return (KNOWN_CALL_STATUSES as readonly string[]).includes(value)
    ? (value as (typeof KNOWN_CALL_STATUSES)[number])
    : "ACTIVE";
});

export const livekitCredsSchema = z.object({
  token: z.string().min(1),
  url: z.string().min(1),
  expiresAt: z.string().optional().nullable(),
});

export const callSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  taskId: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value) => (value == null ? "" : String(value))),
  type: z
    .enum(["AUDIO", "VIDEO"])
    .optional()
    .default("AUDIO")
    .catch("AUDIO"),
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

/** Nest SYSTEM chat row after a connected call ends (`metadata.kind: call_ended`). */
export type CallEndedMessageMetadata = {
  kind: "call_ended";
  callId?: string;
  callType?: CallType | string;
  callStatus?: string;
  durationSec?: number;
  endReason?: string | null;
};

export function isCallEndedMessageMetadata(
  metadata: unknown,
): metadata is CallEndedMessageMetadata {
  if (!metadata || typeof metadata !== "object") return false;
  const kind = (metadata as { kind?: unknown }).kind;
  return kind === "call_ended" || kind === "callEnded";
}

function formatDurationSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  if (safe <= 0) return "Call ended";
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m <= 0) return `${s} sec`;
  if (s <= 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

/** Prefer Nest `content`; fall back to duration metadata. */
export function callEndedMessageBody(
  content: string | null | undefined,
  metadata: unknown,
): string {
  const trimmed = typeof content === "string" ? content.trim() : "";
  if (trimmed) return trimmed;
  if (!isCallEndedMessageMetadata(metadata)) return "Call ended";
  const isVideo =
    String(metadata.callType ?? "").toUpperCase() === "VIDEO";
  const duration =
    typeof metadata.durationSec === "number" ? metadata.durationSec : 0;
  if (duration <= 0) return "Call ended";
  const span = formatDurationSec(duration);
  return isVideo ? `Video call lasted ${span}` : `Call lasted ${span}`;
}
