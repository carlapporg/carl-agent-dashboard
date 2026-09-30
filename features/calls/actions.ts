"use server";

import { callsApi } from "@/lib/api/calls";
import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import type { Call, CallType, LivekitCreds } from "@/types/call";

export type CallActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

function fail(error: unknown): { ok: false; message: string; code?: string } {
  if (isApiError(error)) {
    const nestish = `${error.code} ${error.message}`.toUpperCase();
    if (
      error.status === 409 ||
      nestish.includes("CALLER_BUSY") ||
      nestish.includes("ALREADY_IN_CALL")
    ) {
      return {
        ok: false,
        code: "CALLER_BUSY",
        message:
          "You’re already on a call. End it before starting another.",
      };
    }
    if (
      nestish.includes("CALLEE_BUSY") ||
      nestish.includes("BUSY")
    ) {
      return {
        ok: false,
        code: "CALLEE_BUSY",
        message: "They’re on another call right now. Try again shortly.",
      };
    }
  }
  return { ok: false, message: toUserMessage(error) };
}

export async function startCallAction(
  taskId: string,
  type: CallType = "AUDIO",
): Promise<CallActionResult<Call>> {
  try {
    return { ok: true, data: await callsApi.start(taskId, type) };
  } catch (error) {
    return fail(error);
  }
}

export async function getIncomingCallAction(): Promise<
  CallActionResult<Call | null>
> {
  try {
    return { ok: true, data: await callsApi.incoming() };
  } catch (error) {
    return fail(error);
  }
}

export async function getCallAction(
  callId: string,
): Promise<CallActionResult<Call>> {
  try {
    return { ok: true, data: await callsApi.get(callId) };
  } catch (error) {
    return fail(error);
  }
}

export async function acceptCallAction(
  callId: string,
): Promise<CallActionResult<Call>> {
  try {
    return { ok: true, data: await callsApi.accept(callId) };
  } catch (error) {
    return fail(error);
  }
}

export async function rejectCallAction(
  callId: string,
): Promise<CallActionResult<Call | null>> {
  try {
    return { ok: true, data: await callsApi.reject(callId) };
  } catch (error) {
    return fail(error);
  }
}

export async function endCallAction(
  callId: string,
): Promise<CallActionResult<Call | null>> {
  try {
    return { ok: true, data: await callsApi.end(callId) };
  } catch (error) {
    return fail(error);
  }
}

export async function refreshCallTokenAction(
  callId: string,
): Promise<CallActionResult<LivekitCreds>> {
  try {
    return { ok: true, data: await callsApi.refreshToken(callId) };
  } catch (error) {
    return fail(error);
  }
}

function callAccessFail(error: unknown): { ok: false; message: string; code?: string } {
  if (isApiError(error) && (error.status === 401 || error.status === 403)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only people on this call can open it.",
    };
  }
  return fail(error);
}

export async function getCallTranscriptAction(
  callId: string,
): Promise<
  CallActionResult<{
    text: string | null;
    summary: string | null;
    status: string | null;
  }>
> {
  try {
    return { ok: true, data: await callsApi.getTranscript(callId) };
  } catch (error) {
    return callAccessFail(error);
  }
}

export async function getCallRecordingAction(
  callId: string,
): Promise<
  | { ok: true; url: string }
  | { ok: false; missing: true }
  | { ok: false; missing: false; message: string }
> {
  try {
    return { ok: true, url: await callsApi.getRecordingUrl(callId) };
  } catch (error) {
    if (
      isApiError(error) &&
      (error.status === 404 || error.code === "NOT_FOUND")
    ) {
      return { ok: false, missing: true };
    }
    const failed = callAccessFail(error);
    return { ok: false, missing: false, message: failed.message };
  }
}
