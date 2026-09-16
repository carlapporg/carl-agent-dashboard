"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import {
  acceptCallAction,
  endCallAction,
  refreshCallTokenAction,
  rejectCallAction,
  startCallAction,
} from "@/features/calls/actions";
import { IncomingCallModal } from "@/features/calls/components/incoming-call-modal";
import { ActiveCallOverlay } from "@/features/calls/components/active-call-overlay";
import {
  startIncomingRingtone,
  stopIncomingRingtone,
} from "@/features/calls/ringtone";
import { useOps } from "@/features/ops/ops-provider";
import { useToast } from "@/components/providers/toast-provider";
import { getAgentSocket } from "@/lib/realtime/agent-socket";
import {
  callPeerLabel,
  mergeCallPreserveName,
  parseCallPayload,
  preferPeerName,
} from "@/lib/realtime/parse-call";
import type { Call, CallDirection, CallType } from "@/types/call";

type CallPhase =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active"
  | "ending";

type CallStartMeta = {
  customerName?: string | null;
  taskTitle?: string | null;
  taskNumber?: string | number | null;
};

type CallContextValue = {
  phase: CallPhase;
  call: Call | null;
  direction: CallDirection | null;
  muted: boolean;
  connectionLabel: string;
  elapsedSec: number;
  busy: boolean;
  startCall: (
    taskId: string,
    type?: CallType,
    meta?: CallStartMeta,
  ) => Promise<boolean>;
  acceptIncoming: () => Promise<void>;
  rejectIncoming: () => Promise<void>;
  endActive: () => Promise<void>;
  toggleMute: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

const SOCKET_EVENTS = [
  "call.invite",
  "call_invite",
  "call.ringing",
  "call_ringing",
  "call.accepted",
  "call_accepted",
  "call.connected",
  "call_connected",
  "call.rejected",
  "call_rejected",
  "call.ended",
  "call_ended",
  "call.timeout",
  "call_timeout",
  "call.missed",
  "call_missed",
  "call.failed",
  "call_failed",
  "call.busy",
  "call_busy",
  "notification.created",
  "notification_created",
] as const;

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const ops = useOps();
  const connected = ops?.connected ?? false;
  const { toast } = useToast();

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [call, setCall] = useState<Call | null>(null);
  const [direction, setDirection] = useState<CallDirection | null>(null);
  const [muted, setMuted] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState("Idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [busy, setBusy] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const callRef = useRef<Call | null>(null);
  const activeStartedRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  /** Prevents double join from accept API + call.accepted + call.connected. */
  const joiningRef = useRef(false);
  const joinPromiseRef = useRef<Promise<boolean> | null>(null);
  const joinedCallIdRef = useRef<string | null>(null);
  /** When we end/reject locally, ignore the matching socket toast. */
  const quietHangupIdsRef = useRef<Set<string>>(new Set());
  /** Dedupe terminal socket events (ended + underscore alias, etc.). */
  const handledTerminalIdsRef = useRef<Set<string>>(new Set());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  callIdRef.current = call?.id ?? null;
  callRef.current = call;

  const markQuietHangup = useCallback((callId: string | null | undefined) => {
    if (!callId) return;
    quietHangupIdsRef.current.add(callId);
    window.setTimeout(() => {
      quietHangupIdsRef.current.delete(callId);
    }, 8_000);
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const detachRoom = useCallback(async () => {
    clearRefreshTimer();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try {
        room.removeAllListeners();
        await room.disconnect(true);
      } catch {
        /* ignore */
      }
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, [clearRefreshTimer]);

  const resetToIdle = useCallback(async () => {
    stopIncomingRingtone();
    joiningRef.current = false;
    joinPromiseRef.current = null;
    joinedCallIdRef.current = null;
    await detachRoom();
    setPhase("idle");
    setCall(null);
    setDirection(null);
    setMuted(false);
    setConnectionLabel("Idle");
    setElapsedSec(0);
    setBusy(false);
    activeStartedRef.current = null;
  }, [detachRoom]);

  const scheduleTokenRefresh = useCallback(
    (callId: string, expiresAt?: string | null) => {
      clearRefreshTimer();
      let waitMs = 12 * 60_000;
      if (expiresAt) {
        const ends = new Date(expiresAt).getTime();
        if (Number.isFinite(ends)) {
          waitMs = Math.max(30_000, ends - Date.now() - 60_000);
        }
      }
      refreshTimerRef.current = window.setTimeout(() => {
        void (async () => {
          // Don't tear down a live call for token refresh races.
          if (joinedCallIdRef.current !== callId || !roomRef.current) return;
          const result = await refreshCallTokenAction(callId);
          if (!result.ok) return;
          const room = roomRef.current;
          if (!room || joinedCallIdRef.current !== callId) return;
          try {
            await room.disconnect();
            if (joinedCallIdRef.current !== callId) return;
            await room.connect(result.data.url, result.data.token);
            scheduleTokenRefresh(callId, result.data.expiresAt);
          } catch {
            toast("Call reconnect failed. Try ending and calling again.", "error");
          }
        })();
      }, waitMs);
    },
    [clearRefreshTimer, toast],
  );

  const joinLivekit = useCallback(
    async (next: Call) => {
      // Already in this call's room — never disconnect/rejoin.
      if (
        joinedCallIdRef.current === next.id &&
        roomRef.current &&
        roomRef.current.state !== ConnectionState.Disconnected
      ) {
        return true;
      }

      const creds = next.livekit;
      if (!creds?.token || !creds.url) {
        toast("Missing LiveKit token from server.", "error");
        return false;
      }

      joiningRef.current = true;
      setPhase("connecting");
      setConnectionLabel("Connecting…");

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      // Replace any stale room without racing a second connect.
      const previous = roomRef.current;
      roomRef.current = room;
      if (previous) {
        try {
          previous.removeAllListeners();
          await previous.disconnect(true);
        } catch {
          /* ignore */
        }
      }

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (roomRef.current !== room) return;
        if (state === ConnectionState.Connected) {
          setConnectionLabel("Connected");
          setPhase("active");
          if (!activeStartedRef.current) {
            activeStartedRef.current = Date.now();
          }
        } else if (state === ConnectionState.Reconnecting) {
          setConnectionLabel("Reconnecting…");
        } else if (state === ConnectionState.Disconnected) {
          setConnectionLabel("Disconnected");
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = remoteAudioRef.current;
        if (!el) return;
        track.attach(el);
        void el.play().catch(() => undefined);
      });

      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room) return;
        setConnectionLabel("Disconnected");
      });

      try {
        await room.connect(creds.url, creds.token);
        // Hangup or a newer join replaced this room — exit quietly.
        if (roomRef.current !== room) {
          try {
            room.removeAllListeners();
            await room.disconnect(true);
          } catch {
            /* ignore */
          }
          return false;
        }
        await room.localParticipant.setMicrophoneEnabled(true);
        setMuted(false);
        joinedCallIdRef.current = next.id;
        setPhase("active");
        setConnectionLabel("Connected");
        if (!activeStartedRef.current) {
          activeStartedRef.current = Date.now();
        }
        scheduleTokenRefresh(next.id, creds.expiresAt);
        return true;
      } catch {
        if (roomRef.current === room) {
          toast("Could not join the call room.", "error");
          await detachRoom();
          setPhase(direction === "incoming" ? "incoming" : "outgoing");
          setConnectionLabel("Failed to connect");
        }
        return false;
      } finally {
        joiningRef.current = false;
      }
    },
    [detachRoom, direction, scheduleTokenRefresh, toast],
  );

  const ensureJoined = useCallback(
    async (incoming: Call) => {
      if (
        joinedCallIdRef.current === incoming.id &&
        roomRef.current &&
        roomRef.current.state !== ConnectionState.Disconnected
      ) {
        return;
      }

      if (joinPromiseRef.current) {
        await joinPromiseRef.current;
        return;
      }

      // Reserve the slot synchronously before any await.
      let settle!: (value: boolean) => void;
      const run = new Promise<boolean>((resolve) => {
        settle = resolve;
      });
      joinPromiseRef.current = run;

      try {
        let next = mergeCallPreserveName(callRef.current, incoming);
        setCall(next);
        if (!next.livekit?.token || !next.livekit?.url) {
          const tokenResult = await refreshCallTokenAction(next.id);
          if (!tokenResult.ok) {
            settle(false);
            return;
          }
          next = { ...next, livekit: tokenResult.data };
          setCall(next);
        }
        if (
          joinedCallIdRef.current === next.id &&
          roomRef.current &&
          roomRef.current.state !== ConnectionState.Disconnected
        ) {
          settle(true);
          return;
        }
        settle(await joinLivekit(next));
      } catch {
        settle(false);
      } finally {
        if (joinPromiseRef.current === run) {
          joinPromiseRef.current = null;
        }
      }

      await run;
    },
    [joinLivekit],
  );

  const startCall = useCallback(
    async (
      taskId: string,
      type: CallType = "AUDIO",
      meta?: CallStartMeta,
    ) => {
      // Real in-progress call — block.
      const phaseNow = phaseRef.current;
      const inLiveCall =
        phaseNow === "active" ||
        phaseNow === "incoming" ||
        Boolean(roomRef.current);
      if (inLiveCall) {
        toast("End your current call before starting another.", "error");
        return false;
      }

      // Stale "ringing/connecting" UI with no LiveKit room (common after busy/fail).
      if (phaseNow !== "idle") {
        const staleId = callRef.current?.id;
        if (staleId) {
          await endCallAction(staleId).catch(() => null);
        }
        await resetToIdle();
      }

      setBusy(true);
      const result = await startCallAction(taskId, type);
      setBusy(false);
      if (!result.ok) {
        if (result.code === "CALLER_BUSY") {
          // Nest still has an open call for this agent — clear local and explain.
          await resetToIdle();
          toast(
            "Server still has an open call for you. Wait a few seconds, or end it from the call bar if you see one, then try again.",
            "error",
          );
          return false;
        }
        toast(result.message, "error");
        return false;
      }
      // Stay on "Ringing…" until callee accepts. Seed client name from the task
      // because Nest often omits it (or sends the placeholder "Client").
      const seeded: Call = {
        ...result.data,
        customerName:
          preferPeerName(meta?.customerName, result.data.customerName) ??
          result.data.customerName,
        taskTitle: meta?.taskTitle ?? result.data.taskTitle ?? null,
        taskNumber: meta?.taskNumber ?? result.data.taskNumber ?? null,
      };
      setCall(seeded);
      setDirection("outgoing");
      setPhase("outgoing");
      setConnectionLabel("Calling…");
      return true;
    },
    [resetToIdle, toast],
  );

  const acceptIncoming = useCallback(async () => {
    const current = call;
    // Single-call product: only accept while in incoming (not mid-call).
    if (!current || phase !== "incoming") return;
    if (roomRef.current || joiningRef.current) return;
    stopIncomingRingtone();
    setBusy(true);
    const result = await acceptCallAction(current.id);
    setBusy(false);
    if (!result.ok) {
      if (result.code === "CALLER_BUSY") {
        toast("End your current call before accepting another.", "error");
        return;
      }
      // HTTP may have succeeded but body parse failed — still try to connect.
      // Socket call.accepted will also drive join; avoid a scary false toast.
      await ensureJoined(current);
      return;
    }
    const merged = mergeCallPreserveName(current, result.data);
    setCall(merged);
    setDirection("incoming");
    await ensureJoined(merged);
  }, [call, ensureJoined, phase, toast]);

  const rejectIncoming = useCallback(async () => {
    const current = call;
    if (!current) return;
    stopIncomingRingtone();
    markQuietHangup(current.id);
    setBusy(true);
    await rejectCallAction(current.id);
    setBusy(false);
    await resetToIdle();
  }, [call, markQuietHangup, resetToIdle]);

  const endActive = useCallback(async () => {
    const current = callRef.current;
    markQuietHangup(current?.id);
    if (current?.id) {
      handledTerminalIdsRef.current.add(current.id);
      window.setTimeout(() => {
        if (current.id) handledTerminalIdsRef.current.delete(current.id);
      }, 8_000);
    }
    setBusy(true);
    setPhase("ending");
    if (current?.id) {
      // Ignore result errors — Nest may return odd bodies or "already ended".
      await endCallAction(current.id);
    }
    setBusy(false);
    await resetToIdle();
  }, [markQuietHangup, resetToIdle]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    const next = !muted;
    setMuted(next);
    if (room) {
      void room.localParticipant.setMicrophoneEnabled(!next);
    }
  }, [muted]);

  // Elapsed timer while active / outgoing connected
  useEffect(() => {
    if (phase !== "active" && phase !== "connecting" && phase !== "outgoing") {
      return;
    }
    const id = window.setInterval(() => {
      const started = activeStartedRef.current;
      if (!started) {
        setElapsedSec(0);
        return;
      }
      setElapsedSec(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  // Socket listeners
  useEffect(() => {
    const socket = getAgentSocket();
    if (!socket || !connected) return;

    function onEvent(eventName: string, payload: unknown) {
      const normalized = eventName.replaceAll("_", ".");
      let effectivePayload = payload;

      if (
        normalized === "notification.created" &&
        payload &&
        typeof payload === "object"
      ) {
        const record = payload as Record<string, unknown>;
        const data =
          record.data && typeof record.data === "object"
            ? (record.data as Record<string, unknown>)
            : record;
        if (data.type !== "call.invite" && record.type !== "call.invite") {
          return;
        }
        effectivePayload = data.call ?? data;
      }

      const parsed = parseCallPayload(effectivePayload);
      const name =
        normalized === "notification.created" ? "call.invite" : normalized;

      // Caller-only: peer is busy. Never show this to the callee / idle agent.
      if (name === "call.busy") {
        const phaseNow = phaseRef.current;
        if (phaseNow !== "outgoing" && phaseNow !== "connecting") {
          return;
        }
        const busyId =
          parsed?.id ??
          (effectivePayload &&
          typeof effectivePayload === "object" &&
          typeof (effectivePayload as { id?: unknown }).id === "string"
            ? (effectivePayload as { id: string }).id
            : null);
        if (callIdRef.current && busyId && callIdRef.current !== busyId) {
          return;
        }
        toast("They’re on another call right now.", "error");
        void resetToIdle();
        return;
      }

      if (!parsed) return;

      if (name === "call.invite") {
        // Backend only invites when free; still guard against overlapping UI.
        if (phaseRef.current !== "idle" && callIdRef.current !== parsed.id) {
          return;
        }
        setCall((prev) =>
          callIdRef.current === parsed.id
            ? mergeCallPreserveName(prev, parsed)
            : parsed,
        );
        setDirection("incoming");
        setPhase("incoming");
        setConnectionLabel("Incoming call");
        startIncomingRingtone();
        return;
      }

      if (name === "call.ringing") {
        // Ringing ack is for the caller. Don't flip an incoming invite into "outgoing".
        if (phaseRef.current === "incoming") return;
        if (callIdRef.current && callIdRef.current !== parsed.id) return;
        setCall((prev) => mergeCallPreserveName(prev, parsed));
        setDirection("outgoing");
        setPhase((p) => (p === "idle" || p === "outgoing" ? "outgoing" : p));
        setConnectionLabel("Calling…");
        return;
      }

      if (name === "call.accepted" || name === "call.connected") {
        if (callIdRef.current && callIdRef.current !== parsed.id) return;
        stopIncomingRingtone();
        const merged = mergeCallPreserveName(callRef.current, parsed);
        setCall(merged);

        // Outbound: Nest often emits accepted then connected. Join on connected
        // (or on accepted only when LiveKit creds are already present).
        const outbound =
          phaseRef.current === "outgoing" ||
          phaseRef.current === "connecting" ||
          phaseRef.current === "active";
        if (outbound && name === "call.accepted" && !merged.livekit?.token) {
          setConnectionLabel("Connecting…");
          return;
        }

        if (
          roomRef.current ||
          joiningRef.current ||
          joinPromiseRef.current ||
          joinedCallIdRef.current === merged.id
        ) {
          setPhase("active");
          setConnectionLabel("Connected");
          if (!activeStartedRef.current) {
            activeStartedRef.current = Date.now();
          }
          return;
        }
        void ensureJoined(merged);
        return;
      }

      if (
        name === "call.rejected" ||
        name === "call.ended" ||
        name === "call.timeout" ||
        name === "call.missed" ||
        name === "call.failed"
      ) {
        if (callIdRef.current && callIdRef.current !== parsed.id) return;
        if (handledTerminalIdsRef.current.has(parsed.id)) return;
        handledTerminalIdsRef.current.add(parsed.id);
        window.setTimeout(() => {
          handledTerminalIdsRef.current.delete(parsed.id);
        }, 8_000);

        const endReason =
          effectivePayload &&
          typeof effectivePayload === "object" &&
          "endReason" in effectivePayload
            ? String(
                (effectivePayload as { endReason?: unknown }).endReason ?? "",
              )
            : "";
        const peerBusy =
          name === "call.failed" &&
          (endReason === "callee_busy" ||
            endReason.toUpperCase().includes("BUSY"));

        // Peer-busy is a caller-side event. Ignore if we weren't calling out.
        if (peerBusy) {
          const phaseNow = phaseRef.current;
          if (phaseNow !== "outgoing" && phaseNow !== "connecting") {
            return;
          }
        }

        // Don't tear down a ringing inbound UI on unrelated failed noise.
        if (
          phaseRef.current === "incoming" &&
          name === "call.failed" &&
          !peerBusy
        ) {
          // Still allow fail for this same inbound call id.
          if (callIdRef.current !== parsed.id) return;
        }

        stopIncomingRingtone();

        // We hung up / rejected — UI already cleared; skip duplicate popups.
        if (quietHangupIdsRef.current.has(parsed.id)) {
          void resetToIdle();
          return;
        }

        // Already idle after local end — skip leftover socket noise.
        if (phaseRef.current === "idle" && !callIdRef.current) {
          return;
        }

        const label =
          name === "call.rejected"
            ? "Call rejected"
            : name === "call.timeout" || name === "call.missed"
              ? "No answer"
              : peerBusy
                ? "They’re on another call right now."
                : name === "call.failed"
                  ? "Call failed"
                  : "Call ended";
        toast(label, name === "call.ended" ? "success" : "error");
        void resetToIdle();
      }
    }

    const handlers = SOCKET_EVENTS.map((eventName) => {
      const fn = (payload: unknown) => onEvent(eventName, payload);
      socket.on(eventName, fn);
      return { eventName, fn };
    });

    return () => {
      for (const { eventName, fn } of handlers) {
        socket.off(eventName, fn);
      }
    };
  }, [connected, ensureJoined, resetToIdle, toast]);

  // Keep ringtone in sync with incoming phase (covers remount / late invite).
  useEffect(() => {
    if (phase === "incoming") {
      startIncomingRingtone();
      return () => stopIncomingRingtone();
    }
    stopIncomingRingtone();
  }, [phase]);

  useEffect(() => {
    return () => {
      stopIncomingRingtone();
      void detachRoom();
    };
  }, [detachRoom]);

  const value = useMemo<CallContextValue>(
    () => ({
      phase,
      call,
      direction,
      muted,
      connectionLabel,
      elapsedSec,
      busy,
      startCall,
      acceptIncoming,
      rejectIncoming,
      endActive,
      toggleMute,
    }),
    [
      acceptIncoming,
      busy,
      call,
      connectionLabel,
      direction,
      elapsedSec,
      endActive,
      muted,
      phase,
      rejectIncoming,
      startCall,
      toggleMute,
    ],
  );

  const peer = call && direction ? callPeerLabel(call, direction) : "Customer";
  const taskHint = call
    ? [call.taskTitle, call.taskNumber != null ? `#${call.taskNumber}` : null]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <CallContext.Provider value={value}>
      {children}
      {/* Remote participant audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {phase === "incoming" && call ? (
        <IncomingCallModal
          peerName={peer}
          taskHint={taskHint || "Support call"}
          callType={call.type}
          busy={busy}
          onAccept={() => void acceptIncoming()}
          onReject={() => void rejectIncoming()}
        />
      ) : null}

      {phase === "outgoing" ||
      phase === "connecting" ||
      phase === "active" ||
      phase === "ending" ? (
        <ActiveCallOverlay
          peerName={peer}
          taskHint={taskHint}
          mode={phase}
          statusLabel={
            phase === "outgoing"
              ? "Waiting for them to answer…"
              : phase === "connecting"
                ? "Connecting…"
                : phase === "ending"
                  ? "Ending…"
                  : connectionLabel
          }
          elapsedLabel={formatElapsed(elapsedSec)}
          muted={muted}
          busy={busy}
          onToggleMute={toggleMute}
          onEnd={() => void endActive()}
        />
      ) : null}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
