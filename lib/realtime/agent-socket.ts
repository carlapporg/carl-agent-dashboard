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
let currentKey = "";

export function connectAgentSocket(origin: string, token: string): Socket {
  const key = `${origin}::${token}`;
  if (current && currentKey === key) {
    return current;
  }
  if (current) {
    current.removeAllListeners();
    current.disconnect();
  }
  current = io(origin, {
    auth: { token },
    query: { token },
    extraHeaders: {
      Authorization: `Bearer ${token}`,
      ...(/ngrok/i.test(origin)
        ? { "ngrok-skip-browser-warning": "1" }
        : {}),
    },
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
    autoConnect: true,
  });
  currentKey = key;
  return current;
}

export function joinTaskRoom(socket: Socket, taskId: string) {
  socket.emit("joinTask", { taskId });
}

export function leaveTaskRoom(socket: Socket, taskId: string) {
  socket.emit("leaveTask", { taskId });
}
