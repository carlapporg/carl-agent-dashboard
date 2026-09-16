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
  parseCallPayload,
} from "@/lib/realtime/parse-call";
import type { Call, CallDirection, CallType } from "@/types/call";

type CallPhase =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active"
  | "ending";

type CallContextValue = {
  phase: CallPhase;
  call: Call | null;
  direction: CallDirection | null;
  muted: boolean;
  connectionLabel: string;
  elapsedSec: number;
  busy: boolean;
  startCall: (taskId: string, type?: CallType) => Promise<boolean>;
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
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  callIdRef.current = call?.id ?? null;
  callRef.current = call;

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
          const result = await refreshCallTokenAction(callId);
          if (!result.ok) return;
          const room = roomRef.current;
          if (!room) return;
          try {
            await room.disconnect();
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
      const creds = next.livekit;
      if (!creds?.token || !creds.url) {
        toast("Missing LiveKit token from server.", "error");
        return false;
      }

      await detachRoom();
      setPhase("connecting");
      setConnectionLabel("Connecting…");

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
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
        setConnectionLabel("Disconnected");
      });

      try {
        await room.connect(creds.url, creds.token);
        await room.localParticipant.setMicrophoneEnabled(true);
        setMuted(false);
        setPhase("active");
        setConnectionLabel("Connected");
        if (!activeStartedRef.current) {
          activeStartedRef.current = Date.now();
        }
        scheduleTokenRefresh(next.id, creds.expiresAt);
        return true;
      } catch {
        toast("Could not join the call room.", "error");
        await detachRoom();
        setPhase(direction === "incoming" ? "incoming" : "outgoing");
        setConnectionLabel("Failed to connect");
        return false;
      }
    },
    [detachRoom, direction, scheduleTokenRefresh, toast],
  );

  const startCall = useCallback(
    async (taskId: string, type: CallType = "AUDIO") => {
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
      setCall(result.data);
      setDirection("outgoing");
      setPhase("outgoing");
      setConnectionLabel("Ringing…");
      if (result.data.livekit?.token) {
        void joinLivekit(result.data);
      }
      return true;
    },
    [joinLivekit, resetToIdle, toast],
  );

  const acceptIncoming = useCallback(async () => {
    const current = call;
    // Single-call product: only accept while in incoming (not mid-call).
    if (!current || phase !== "incoming") return;
    if (roomRef.current) {
      toast("End your current call before accepting another.", "error");
      return;
    }
    stopIncomingRingtone();
    setBusy(true);
    const result = await acceptCallAction(current.id);
    setBusy(false);
    if (!result.ok) {
      toast(
        result.code === "CALLER_BUSY"
          ? "End your current call before accepting another."
          : result.message,
        "error",
      );
      return;
    }
    setCall(result.data);
    setDirection("incoming");
    await joinLivekit(result.data);
  }, [call, joinLivekit, phase, toast]);

  const rejectIncoming = useCallback(async () => {
    const current = call;
    if (!current) return;
    stopIncomingRingtone();
    setBusy(true);
    const result = await rejectCallAction(current.id);
    setBusy(false);
    if (!result.ok) toast(result.message, "error");
    await resetToIdle();
  }, [call, resetToIdle, toast]);

  const endActive = useCallback(async () => {
    const current = callRef.current;
    setBusy(true);
    setPhase("ending");
    if (current?.id) {
      const result = await endCallAction(current.id);
      if (!result.ok) {
        // Still clear local UI so the agent isn't stuck.
        toast(result.message, "error");
      }
    }
    setBusy(false);
    await resetToIdle();
  }, [resetToIdle, toast]);

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
        setCall(parsed);
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
        setCall((prev) => ({ ...(prev ?? parsed), ...parsed }));
        setDirection("outgoing");
        setPhase((p) => (p === "idle" || p === "outgoing" ? "outgoing" : p));
        setConnectionLabel("Ringing…");
        return;
      }

      if (name === "call.accepted" || name === "call.connected") {
        if (callIdRef.current && callIdRef.current !== parsed.id) return;
        stopIncomingRingtone();
        const merged = { ...(callRef.current ?? parsed), ...parsed };
        setCall(merged);
        if (merged.livekit?.token && !roomRef.current) {
          void joinLivekit(merged);
        } else {
          setPhase("active");
          setConnectionLabel("Connected");
          if (!activeStartedRef.current) {
            activeStartedRef.current = Date.now();
          }
        }
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
  }, [connected, joinLivekit, resetToIdle, toast]);

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
          statusLabel={
            phase === "outgoing"
              ? "Calling…"
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
