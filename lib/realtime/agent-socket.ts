"use client";

import { io, type Socket } from "socket.io-client";

export type AgentSocketEvents = {
  "task.assigned": (payload: unknown) => void;
  "task.message": (payload: unknown) => void;
  "task.cancelled": (payload: unknown) => void;
};

export function connectAgentSocket(origin: string, token: string): Socket {
  return io(origin, {
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
    reconnectionDelay: 2000,
    reconnectionDelayMax: 20000,
    autoConnect: true,
  });
}

export function joinTaskRoom(socket: Socket, taskId: string) {
  socket.emit("joinTask", { taskId });
}
