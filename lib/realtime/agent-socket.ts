"use client";

import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import type { AgentPresence } from "@/types/agent";

export type AgentSocketEvents = {
  "task.offered": (payload: unknown) => void;
  "task.assigned": (payload: unknown) => void;
  "task.message": (payload: unknown) => void;
  "task.cancelled": (payload: unknown) => void;
  "payment.approved": (payload: unknown) => void;
  "payment.declined": (payload: unknown) => void;
  "payment.expired": (payload: unknown) => void;
  "task.status_changed": (payload: unknown) => void;
  "task.missed": (payload: unknown) => void;
  "task.confirmation_confirmed": (payload: unknown) => void;
  "task.confirmation_declined": (payload: unknown) => void;
  "task.receipt_accepted": (payload: unknown) => void;
  "task.receipt_rejected": (payload: unknown) => void;
  "agentAdmin.message": (payload: unknown) => void;
  "agentAdmin.conversation_updated": (payload: unknown) => void;
};

type IoOpts = Partial<ManagerOptions> &
  SocketOptions & {
    extraHeaders?: Record<string, string>;
  };

let current: Socket | null = null;
let currentOrigin = "";
let latestToken = "";
let retainCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function handshakeAuth(cb: (data: { token: string }) => void) {
  cb({ token: latestToken });
}

function extraHeadersFor(origin: string): Record<string, string> {
  return /ngrok/i.test(origin)
    ? { "ngrok-skip-browser-warning": "1" }
    : {};
}

/**
 * HTTPS page + HTTP Nest would be blocked (mixed content).
 * Connect to this app's origin instead; next.config rewrites /socket.io → Nest.
 */
export function resolveBrowserSocketUrl(configuredOrigin: string): {
  url: string;
  viaSameOriginProxy: boolean;
} {
  const trimmed = configuredOrigin.trim().replace(/\/$/, "");
  if (!trimmed || typeof window === "undefined") {
    return { url: trimmed, viaSameOriginProxy: false };
  }

  let targetIsHttp = false;
  try {
    targetIsHttp = new URL(trimmed).protocol === "http:";
  } catch {
    return { url: trimmed, viaSameOriginProxy: false };
  }

  const pageIsHttps = window.location.protocol === "https:";
  if (pageIsHttps && targetIsHttp) {
    return { url: window.location.origin, viaSameOriginProxy: true };
  }

  return { url: trimmed, viaSameOriginProxy: false };
}

function applyAuth(token: string) {
  latestToken = token;
  if (!current) return;
  current.auth = handshakeAuth;
  const opts = current.io?.opts as IoOpts | undefined;
  if (!opts) return;
  opts.auth = handshakeAuth;
  opts.extraHeaders = extraHeadersFor(currentOrigin);
  const query = opts.query;
  if (query && typeof query === "object" && !Array.isArray(query)) {
    opts.query = { ...query, token };
  } else {
    opts.query = { token };
  }
}

export function updateAgentSocketAuth(token: string) {
  if (!token) return;
  applyAuth(token);
}

export function ensureAgentSocketConnected() {
  if (!current) return;
  if (current.connected || current.active) return;
  current.connect();
}

export function connectAgentSocket(origin: string, token: string): Socket {
  latestToken = token;
  retainCount += 1;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  const { url, viaSameOriginProxy } = resolveBrowserSocketUrl(origin);

  if (current && currentOrigin === url) {
    applyAuth(token);
    ensureAgentSocketConnected();
    return current;
  }
  if (current) {
    current.removeAllListeners();
    current.disconnect();
    current = null;
  }

  // Proxy mode: polling first — more reliable through Vercel HTTP rewrites.
  // Direct mode: prefer websocket as before.
  const transports: ("websocket" | "polling")[] = viaSameOriginProxy
    ? ["polling", "websocket"]
    : ["websocket", "polling"];

  current = io(url, {
    auth: handshakeAuth,
    query: { token },
    path: "/socket.io",
    extraHeaders: extraHeadersFor(url),
    transports,
    rememberUpgrade: !viaSameOriginProxy,
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
    randomizationFactor: 0.5,
    timeout: 20_000,
    autoConnect: true,
  });
  currentOrigin = url;
  applyAuth(token);
  return current;
}

export function disconnectAgentSocket() {
  if (!current) return;
  current.removeAllListeners();
  current.disconnect();
  current = null;
  currentOrigin = "";
  retainCount = 0;
}

export function releaseAgentSocket() {
  retainCount = Math.max(0, retainCount - 1);
  if (retainCount > 0) return;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (retainCount === 0) disconnectAgentSocket();
  }, 2_000);
}

export function getAgentSocket(): Socket | null {
  return current;
}

export function emitAgentAvailability(status: AgentPresence) {
  const socket = getAgentSocket();
  if (!socket?.connected) return;
  socket.emit("agent.availability", { status });
}

export function joinTaskRoom(socket: Socket, taskId: string) {
  if (!taskId || !socket.connected) return;
  socket.emit("joinTask", { taskId });
}

export function leaveTaskRoom(socket: Socket, taskId: string) {
  if (!taskId || !socket.connected) return;
  socket.emit("leaveTask", { taskId });
}

/** Join `agentAdmin:{conversationId}` for an open admin↔agent thread. */
export function joinAgentAdminRoom(socket: Socket, conversationId: string) {
  if (!conversationId || !socket.connected) return;
  socket.emit("joinAgentAdmin", { conversationId });
}
