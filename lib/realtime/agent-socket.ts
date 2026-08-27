"use client";

import { io, type Socket } from "socket.io-client";

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
};

let current: Socket | null = null;
let currentOrigin = "";
let latestToken = "";
let retainCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function handshakeAuth(cb: (data: { token: string }) => void) {
  cb({ token: latestToken });
}

function applyAuth(token: string) {
  latestToken = token;
  if (!current) return;
  current.auth = { token };
  const opts = current.io?.opts;
  if (!opts) return;
  opts.auth = handshakeAuth;
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
  if (current && currentOrigin === origin) {
    applyAuth(token);
    ensureAgentSocketConnected();
    return current;
  }
  if (current) {
    current.removeAllListeners();
    current.disconnect();
    current = null;
  }
  current = io(origin, {
    auth: handshakeAuth,
    query: { token },
    extraHeaders: {
      Authorization: `Bearer ${token}`,
      ...(/ngrok/i.test(origin)
        ? { "ngrok-skip-browser-warning": "1" }
        : {}),
    },
    transports: ["websocket", "polling"],
    rememberUpgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    randomizationFactor: 0.5,
    timeout: 20_000,
    autoConnect: true,
  });
  currentOrigin = origin;
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
  }, 300);
}

export function joinTaskRoom(socket: Socket, taskId: string) {
  socket.emit("joinTask", { taskId });
}

export function leaveTaskRoom(socket: Socket, taskId: string) {
  socket.emit("leaveTask", { taskId });
}
