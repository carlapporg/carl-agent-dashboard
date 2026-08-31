import { mapAgentMessageToTimeline } from "@/lib/api/map-task";
import { agentTaskMessageSchema } from "@/types/agent";
import type { ChatMediaKind, TimelineEvent } from "@/types/message";

export const TASK_MEDIA = {
  maxImageBytes: 10 * 1024 * 1024,
  maxVoiceBytes: 16 * 1024 * 1024,
  maxVoiceMs: 120_000,
} as const;

export function dashboardVoiceUploadUrl(taskId: string): string {
  return `/api/agent/tasks/${encodeURIComponent(taskId)}/messages/voice`;
}

export function dashboardImageUploadUrl(taskId: string): string {
  return `/api/agent/tasks/${encodeURIComponent(taskId)}/messages/image`;
}

export function dashboardAudioSrc(taskId: string, messageId: string): string {
  return `/api/agent/tasks/${encodeURIComponent(taskId)}/messages/${encodeURIComponent(messageId)}/audio`;
}

export function dashboardImageSrc(taskId: string, messageId: string): string {
  return `/api/agent/tasks/${encodeURIComponent(taskId)}/messages/${encodeURIComponent(messageId)}/image`;
}

export function dashboardReceiptFileSrc(taskId: string, receiptId: string): string {
  return `/api/agent/tasks/${encodeURIComponent(taskId)}/receipts/${encodeURIComponent(receiptId)}/file`;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
}

export function voiceFilename(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) {
    return "voice.m4a";
  }
  if (mimeType.includes("ogg")) return "voice.ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "voice.mp3";
  return "voice.webm";
}

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function formatClockMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function errorMessageFromRaw(raw: unknown, fallback: string): string {
  const record = asRecord(raw);
  if (!record) return fallback;
  const message = record.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  const nested = asRecord(record.error);
  if (nested && typeof nested.message === "string" && nested.message.trim()) {
    return nested.message;
  }
  return fallback;
}

function timelineFromUpload(raw: unknown, taskId: string, fallback: TimelineEvent): TimelineEvent {
  const record = asRecord(raw);
  const payload = record && "data" in record ? record.data : raw;
  const parsed = agentTaskMessageSchema.safeParse(payload);
  if (!parsed.success) return fallback;
  const event = mapAgentMessageToTimeline(parsed.data);
  return {
    ...event,
    taskId: event.taskId || taskId,
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

export type MediaUploadInput = {
  taskId: string;
  kind: Exclude<ChatMediaKind, "text">;
  file: Blob;
  filename: string;
  durationMs?: number;
  caption?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export function uploadTaskMedia(input: MediaUploadInput): Promise<TimelineEvent> {
  const form = new FormData();
  form.append("file", input.file, input.filename);
  if (input.kind === "voice" && input.durationMs != null) {
    form.append("durationMs", String(Math.round(input.durationMs)));
  }
  if (input.kind === "image" && input.caption?.trim()) {
    form.append("caption", input.caption.trim());
  }

  const url =
    input.kind === "voice"
      ? dashboardVoiceUploadUrl(input.taskId)
      : dashboardImageUploadUrl(input.taskId);

  const fallback: TimelineEvent = {
    id: `local-${Date.now()}`,
    taskId: input.taskId,
    kind: "agent_message",
    body: input.caption?.trim() ?? "",
    createdAt: new Date().toISOString(),
    visibleToCustomer: true,
    mediaKind: input.kind,
    durationMs: input.durationMs ?? null,
    mimeType: input.file.type || null,
  };

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(1, Math.round((event.loaded / event.total) * 100));
      input.onProgress?.(Math.min(99, percent));
    };

    xhr.onload = () => {
      let raw: unknown = null;
      try {
        raw = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        raw = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress?.(100);
        resolve(timelineFromUpload(raw, input.taskId, fallback));
        return;
      }
      reject(new Error(errorMessageFromRaw(raw, "Couldn't send. Please try again.")));
    };

    xhr.onerror = () => {
      reject(new Error("Unable to connect to server. Please try again."));
    };
    xhr.onabort = () => {
      reject(new Error("Upload cancelled."));
    };
    xhr.ontimeout = () => {
      reject(new Error("That took too long. Please try again."));
    };
    xhr.timeout = 90_000;

    if (input.signal) {
      if (input.signal.aborted) {
        xhr.abort();
        return;
      }
      input.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
