import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  callSchema,
  livekitCredsSchema,
  type Call,
  type CallType,
  type LivekitCreds,
} from "@/types/call";

function unwrapCall(data: unknown): Call {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (record.call && typeof record.call === "object") {
      const nested = callSchema.safeParse(record.call);
      if (nested.success) {
        const livekit =
          record.livekit != null
            ? livekitCredsSchema.safeParse(record.livekit)
            : null;
        return {
          ...nested.data,
          livekit: livekit?.success
            ? livekit.data
            : nested.data.livekit ?? null,
        };
      }
    }
  }
  const parsed = callSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  throw new Error("Invalid call response");
}

function unwrapLivekit(data: unknown): LivekitCreds {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const direct = livekitCredsSchema.safeParse(record.livekit ?? record);
    if (direct.success) return direct.data;
    if (record.data) {
      const nested = livekitCredsSchema.safeParse(
        (record.data as { livekit?: unknown }).livekit ?? record.data,
      );
      if (nested.success) return nested.data;
    }
  }
  throw new Error("Invalid LiveKit token response");
}

export const callsApi = {
  async start(taskId: string, type: CallType = "AUDIO"): Promise<Call> {
    const data = await apiRequest(API_ENDPOINTS.calls.root, {
      method: "POST",
      body: { taskId, type },
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    return unwrapCall(data);
  },

  async get(callId: string): Promise<Call> {
    const data = await apiRequest(API_ENDPOINTS.calls.one(callId), {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    return unwrapCall(data);
  },

  async accept(callId: string): Promise<Call> {
    const data = await apiRequest(API_ENDPOINTS.calls.accept(callId), {
      method: "POST",
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    return unwrapCall(data);
  },

  async reject(callId: string): Promise<Call | null> {
    const data = await apiRequest(API_ENDPOINTS.calls.reject(callId), {
      method: "POST",
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    try {
      return unwrapCall(data);
    } catch {
      return null;
    }
  },

  async end(callId: string): Promise<Call | null> {
    const data = await apiRequest(API_ENDPOINTS.calls.end(callId), {
      method: "POST",
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    try {
      return unwrapCall(data);
    } catch {
      return null;
    }
  },

  async refreshToken(callId: string): Promise<LivekitCreds> {
    const data = await apiRequest(API_ENDPOINTS.calls.token(callId), {
      method: "POST",
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    return unwrapLivekit(data);
  },
};
