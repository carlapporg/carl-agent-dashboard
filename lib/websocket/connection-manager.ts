import {
  createClientEnvelope,
  parseWsEnvelope,
  type WsConnectionState,
  type WsEnvelope,
  type WsSubscribeTarget,
} from "@/types/websocket";
import { resolveWebSocketUrl } from "@/lib/websocket/url";

export type WsEventHandler = (event: WsEnvelope) => void;

export type WebSocketManagerOptions = {
  /** Override URL; otherwise uses resolveWebSocketUrl(). */
  url?: string | null;
  /**
   * Return a short-lived access token (or WS ticket) for the auth frame.
   * Leave unset / return null while backend auth is not ready.
   */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Auto-connect on construct. Default false — provider controls lifecycle. */
  autoConnect?: boolean;
  /** Max reconnect attempts before giving up (0 = unlimited). Default 0. */
  maxReconnectAttempts?: number;
  /** Base delay (ms) for exponential backoff. Default 1000. */
  reconnectBaseMs?: number;
  /** Cap delay (ms). Default 30_000. */
  reconnectMaxMs?: number;
  /** Send ping every N ms while open. Default 25_000. 0 disables. */
  heartbeatMs?: number;
  onStateChange?: (state: WsConnectionState) => void;
  onError?: (error: Error) => void;
};

/**
 * Singleton-friendly native WebSocket connection manager.
 * No Socket.IO — browser WebSocket only.
 */
export class WebSocketConnectionManager {
  private socket: WebSocket | null = null;
  private state: WsConnectionState = "idle";
  private readonly handlers = new Map<string, Set<WsEventHandler>>();
  private readonly anyHandlers = new Set<WsEventHandler>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;
  private readonly options: Required<
    Pick<
      WebSocketManagerOptions,
      | "maxReconnectAttempts"
      | "reconnectBaseMs"
      | "reconnectMaxMs"
      | "heartbeatMs"
    >
  > &
    WebSocketManagerOptions;

  constructor(options: WebSocketManagerOptions = {}) {
    this.options = {
      maxReconnectAttempts: 0,
      reconnectBaseMs: 1000,
      reconnectMaxMs: 30_000,
      heartbeatMs: 25_000,
      ...options,
    };
    if (options.autoConnect) {
      void this.connect();
    }
  }

  getConnectionState(): WsConnectionState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === "ready" || this.state === "open";
  }

  /**
   * Open the socket. Safe to call repeatedly (no-op if already open/connecting).
   */
  async connect(): Promise<void> {
    if (typeof window === "undefined") return;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = resolveWebSocketUrl(this.options.url);
    if (!url) {
      this.setState("idle");
      return;
    }

    this.intentionalClose = false;
    this.setState(
      this.reconnectAttempt > 0 ? "reconnecting" : "connecting",
    );

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener("open", () => {
        void this.handleOpen();
      });

      socket.addEventListener("message", (event) => {
        this.handleMessage(event);
      });

      socket.addEventListener("error", () => {
        this.options.onError?.(new Error("WebSocket error"));
        this.setState("error");
      });

      socket.addEventListener("close", () => {
        this.clearHeartbeat();
        this.socket = null;
        if (this.intentionalClose) {
          this.setState("closed");
          return;
        }
        this.scheduleReconnect();
      });
    } catch (error) {
      this.options.onError?.(
        error instanceof Error ? error : new Error("WebSocket connect failed"),
      );
      this.setState("error");
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnect();
    this.clearHeartbeat();
    if (this.socket) {
      try {
        this.socket.close(1000, "client_disconnect");
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setState("closed");
  }

  /**
   * Subscribe to a specific event type, or pass "*" for all events.
   * Returns an unsubscribe function.
   */
  on(type: string, handler: WsEventHandler): () => void {
    if (type === "*") {
      this.anyHandlers.add(handler);
      return () => {
        this.anyHandlers.delete(handler);
      };
    }

    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);

    return () => {
      set?.delete(handler);
      if (set && set.size === 0) this.handlers.delete(type);
    };
  }

  /** Send a raw envelope (must be connected). */
  send(envelope: WsEnvelope): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify(envelope));
    return true;
  }

  /** Helper: send a typed client event. */
  emit(
    type: string,
    payload: Record<string, unknown> = {},
    extras?: { taskId?: string; channel?: string },
  ): boolean {
    return this.send(createClientEnvelope(type, payload, extras));
  }

  /**
   * Ask the server to subscribe this connection to a channel.
   * Backend contract (placeholder): { type: "subscribe", channel, taskId? }
   */
  subscribe(target: WsSubscribeTarget): boolean {
    switch (target.channel) {
      case "queue":
        return this.emit("subscribe", {}, { channel: "queue" });
      case "task.messages":
        return this.emit(
          "subscribe",
          {},
          { channel: "task.messages", taskId: target.taskId },
        );
      case "agent.alerts":
      case "agent.payments":
        return this.emit("subscribe", {}, { channel: target.channel });
      default:
        return false;
    }
  }

  unsubscribe(target: WsSubscribeTarget): boolean {
    switch (target.channel) {
      case "queue":
        return this.emit("unsubscribe", {}, { channel: "queue" });
      case "task.messages":
        return this.emit(
          "unsubscribe",
          {},
          { channel: "task.messages", taskId: target.taskId },
        );
      case "agent.alerts":
      case "agent.payments":
        return this.emit("unsubscribe", {}, { channel: target.channel });
      default:
        return false;
    }
  }

  private async handleOpen(): Promise<void> {
    this.reconnectAttempt = 0;
    this.startHeartbeat();

    const token = await this.options.getAccessToken?.();
    if (token) {
      this.setState("authenticating");
      this.emit("auth", { token });
      // Wait for server `auth.ok`. If backend has no auth yet, it should
      // either skip requiring auth or reply with auth.ok immediately.
      return;
    }

    // No token (backend not ready) — connection is usable for local/dev stubs.
    this.setState("ready");
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") return;
    const envelope = parseWsEnvelope(event.data);
    if (!envelope) return;

    if (envelope.type === "ping") {
      this.emit("pong", { id: envelope.id });
      return;
    }

    if (envelope.type === "auth.ok") {
      this.setState("ready");
    }

    if (envelope.type === "auth.error") {
      this.setState("error");
      this.options.onError?.(
        new Error(
          typeof envelope.payload.message === "string"
            ? envelope.payload.message
            : "WebSocket authentication failed",
        ),
      );
      this.disconnect();
      return;
    }

    const typed = this.handlers.get(envelope.type);
    if (typed) {
      for (const handler of typed) handler(envelope);
    }
    for (const handler of this.anyHandlers) handler(envelope);
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    const max = this.options.maxReconnectAttempts;
    if (max > 0 && this.reconnectAttempt >= max) {
      this.setState("closed");
      return;
    }

    const attempt = this.reconnectAttempt;
    const delay = Math.min(
      this.options.reconnectBaseMs * 2 ** attempt,
      this.options.reconnectMaxMs,
    );
    this.reconnectAttempt += 1;
    this.setState("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    const ms = this.options.heartbeatMs;
    if (!ms) return;
    this.heartbeatTimer = setInterval(() => {
      this.emit("ping", {});
    }, ms);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setState(next: WsConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.options.onStateChange?.(next);
  }
}
