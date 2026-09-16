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
  acceptCallAction,
  endCallAction,
  refreshCallTokenAction,
  rejectCallAction,
  startCallAction,
} from "@/features/calls/actions";
import { IncomingCallModal } from "@/features/calls/components/incoming-call-modal";
import { ActiveCallOverlay } from "@/features/calls/components/active-call-overlay";
import {
  disconnectLivekitSession,
  getLivekitCallId,
  isLivekitJoined,
  joinLivekitSession,
  refreshLivekitSession,
  setLivekitMicrophoneEnabled,
  setLivekitRemoteAudioElement,
  setLivekitSessionHandlers,
} from "@/features/calls/livekit-session";
import {
  startIncomingRingtone,
  stopIncomingRingtone,
} from "@/features/calls/ringtone";
import { useOps } from "@/features/ops/ops-provider";
import { useToast } from "@/components/providers/toast-provider";
import { getAgentSocket } from "@/lib/realtime/agent-socket";
import {
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

  const roomAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const callRef = useRef<Call | null>(null);
  const activeStartedRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  /** When we end/reject locally, ignore the matching socket toast. */
  const quietHangupIdsRef = useRef<Set<string>>(new Set());
  /** Dedupe terminal socket events (ended + underscore alias, etc.). */
  const handledTerminalIdsRef = useRef<Set<string>>(new Set());
  const phaseRef = useRef(phase);
  const directionRef = useRef(direction);
  const ensureJoinedRef = useRef<(call: Call) => Promise<void>>(async () => {});
  const ensureJoinedInflightRef = useRef<Promise<void> | null>(null);
  const resetToIdleRef = useRef<() => Promise<void>>(async () => {});
  /** Call ids we started (outbound) — never show Accept/Reject for these. */
  const outboundCallIdsRef = useRef<Set<string>>(new Set());
  /** Task ids with an in-flight POST /calls (invite may arrive before response). */
  const pendingOutboundTaskIdsRef = useRef<Set<string>>(new Set());
  const liveTasksRef = useRef(ops?.liveTasks ?? []);
  liveTasksRef.current = ops?.liveTasks ?? [];
  phaseRef.current = phase;
  directionRef.current = direction;
  callIdRef.current = call?.id ?? null;
  callRef.current = call;

  const resolveCustomerName = useCallback((row: Call): string => {
    const fromTask = liveTasksRef.current.find((t) => t.id === row.taskId);
    return (
      preferPeerName(
        row.customerName,
        fromTask?.customerName,
        row.agentName,
      ) || "Customer"
    );
  }, []);

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

  const resetToIdle = useCallback(async () => {
    stopIncomingRingtone();
    clearRefreshTimer();
    await disconnectLivekitSession();
    if (callIdRef.current) {
      outboundCallIdsRef.current.delete(callIdRef.current);
    }
    setPhase("idle");
    setCall(null);
    setDirection(null);
    setMuted(false);
    setConnectionLabel("Idle");
    setElapsedSec(0);
    setBusy(false);
    activeStartedRef.current = null;
  }, [clearRefreshTimer]);
  resetToIdleRef.current = resetToIdle;

  const applyOutboundRinging = useCallback((row: Call) => {
    outboundCallIdsRef.current.add(row.id);
    pendingOutboundTaskIdsRef.current.delete(row.taskId);
    const named = {
      ...row,
      customerName: resolveCustomerName(row),
      livekit: null,
    };
    setCall((prev) => mergeCallPreserveName(prev, named));
    setDirection("outgoing");
    setPhase("outgoing");
    setConnectionLabel("Calling…");
    stopIncomingRingtone();
  }, [resolveCustomerName]);

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
          if (!isLivekitJoined(callId)) return;
          const result = await refreshCallTokenAction(callId);
          if (!result.ok || !isLivekitJoined(callId)) return;
          const ok = await refreshLivekitSession({
            callId,
            creds: result.data,
          });
          if (!ok) {
            toast("Call reconnect failed. Try ending and calling again.", "error");
            return;
          }
          scheduleTokenRefresh(callId, result.data.expiresAt);
        })();
      }, waitMs);
    },
    [clearRefreshTimer, toast],
  );

  const ensureJoined = useCallback(
    async (incoming: Call) => {
      if (isLivekitJoined(incoming.id)) {
        setPhase("active");
        setConnectionLabel("Connected");
        if (!activeStartedRef.current) {
          activeStartedRef.current = Date.now();
        }
        return;
      }

      if (ensureJoinedInflightRef.current) {
        await ensureJoinedInflightRef.current;
        return;
      }

      const run = (async () => {
        const next = mergeCallPreserveName(callRef.current, incoming);
        setCall(next);
        setPhase("connecting");
        setConnectionLabel("Connecting…");

        // Always mint a token as the logged-in agent via POST /calls/:id/token.
        // Socket/start payloads can carry the peer's LiveKit identity; joining
        // with that causes DUPLICATE_IDENTITY (leave reason 2) on outbound calls.
        const tokenResult = await refreshCallTokenAction(next.id);
        if (!tokenResult.ok) {
          toast(
            tokenResult.message || "Could not get call audio credentials.",
            "error",
          );
          setPhase(
            directionRef.current === "incoming" ? "incoming" : "outgoing",
          );
          setConnectionLabel("Failed to connect");
          return;
        }

        if (isLivekitJoined(next.id)) {
          setPhase("active");
          setConnectionLabel("Connected");
          return;
        }

        const withCreds: Call = { ...next, livekit: tokenResult.data };
        setCall(withCreds);

        const ok = await joinLivekitSession({
          callId: withCreds.id,
          creds: tokenResult.data,
        });
        if (!ok) {
          if (
            getLivekitCallId() !== withCreds.id &&
            !isLivekitJoined(withCreds.id)
          ) {
            toast("Could not join the call room.", "error");
            setPhase(
              directionRef.current === "incoming" ? "incoming" : "outgoing",
            );
            setConnectionLabel("Failed to connect");
          }
          return;
        }

        setMuted(false);
        setPhase("active");
        setConnectionLabel("Connected");
        if (!activeStartedRef.current) {
          activeStartedRef.current = Date.now();
        }
        scheduleTokenRefresh(withCreds.id, tokenResult.data.expiresAt);
      })();

      ensureJoinedInflightRef.current = run;
      try {
        await run;
      } finally {
        if (ensureJoinedInflightRef.current === run) {
          ensureJoinedInflightRef.current = null;
        }
      }
    },
    [scheduleTokenRefresh, toast],
  );
  ensureJoinedRef.current = ensureJoined;

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
        isLivekitJoined();
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

      pendingOutboundTaskIdsRef.current.add(taskId);
      setBusy(true);
      const result = await startCallAction(taskId, type);
      setBusy(false);
      if (!result.ok) {
        pendingOutboundTaskIdsRef.current.delete(taskId);
        if (result.code === "CALLER_BUSY") {
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
      // Stay on outbound ringing UI until callee accepts. Never show Accept/Reject.
      applyOutboundRinging({
        ...result.data,
        customerName:
          preferPeerName(meta?.customerName, result.data.customerName) ??
          result.data.customerName,
        taskTitle: meta?.taskTitle ?? result.data.taskTitle ?? null,
        taskNumber: meta?.taskNumber ?? result.data.taskNumber ?? null,
        livekit: null,
      });
      return true;
    },
    [applyOutboundRinging, resetToIdle, toast],
  );

  const acceptIncoming = useCallback(async () => {
    const current = call;
    if (!current || phase !== "incoming") return;
    if (isLivekitJoined()) return;
    stopIncomingRingtone();
    setBusy(true);
    const result = await acceptCallAction(current.id);
    setBusy(false);
    if (!result.ok) {
      if (result.code === "CALLER_BUSY") {
        toast("End your current call before accepting another.", "error");
        return;
      }
      await ensureJoined(current);
      return;
    }
    const merged = mergeCallPreserveName(current, result.data);
    setCall(merged);
    setDirection("incoming");
    await ensureJoined(merged);
  }, [call, ensureJoined, phase, toast]);

  const endActive = useCallback(async () => {
    const current = callRef.current;
    markQuietHangup(current?.id);
    if (current?.id) {
      outboundCallIdsRef.current.delete(current.id);
      handledTerminalIdsRef.current.add(current.id);
      window.setTimeout(() => {
        if (current.id) handledTerminalIdsRef.current.delete(current.id);
      }, 8_000);
    }
    setBusy(true);
    setPhase("ending");
    if (current?.id) {
      await endCallAction(current.id);
    }
    setBusy(false);
    await resetToIdle();
  }, [markQuietHangup, resetToIdle]);

  const rejectIncoming = useCallback(async () => {
    const current = call;
    if (!current) return;
    // Safety: outbound must END (stops mobile ring). Reject only dismisses UI.
    if (
      direction === "outgoing" ||
      outboundCallIdsRef.current.has(current.id)
    ) {
      await endActive();
      return;
    }
    stopIncomingRingtone();
    markQuietHangup(current.id);
    setBusy(true);
    await rejectCallAction(current.id);
    setBusy(false);
    await resetToIdle();
  }, [call, direction, endActive, markQuietHangup, resetToIdle]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      void setLivekitMicrophoneEnabled(!next);
      return next;
    });
  }, []);

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
        // Nest often echoes invite to the agent who just started the call.
        // That must stay outbound (ringing + Cancel), never Accept/Reject.
        const isOurOutbound =
          outboundCallIdsRef.current.has(parsed.id) ||
          pendingOutboundTaskIdsRef.current.has(parsed.taskId) ||
          directionRef.current === "outgoing" ||
          phaseRef.current === "outgoing" ||
          phaseRef.current === "connecting" ||
          phaseRef.current === "active" ||
          phaseRef.current === "ending";

        if (isOurOutbound) {
          applyOutboundRinging({
            ...parsed,
            customerName: resolveCustomerName(
              mergeCallPreserveName(callRef.current, parsed),
            ),
          });
          return;
        }

        // True inbound: only from idle.
        if (phaseRef.current !== "idle") return;

        const named = {
          ...parsed,
          customerName: resolveCustomerName(parsed),
        };
        setCall(named);
        setDirection("incoming");
        setPhase("incoming");
        setConnectionLabel("Incoming call");
        startIncomingRingtone();
        return;
      }

      if (name === "call.ringing") {
        // Ringing ack is for the caller.
        if (
          outboundCallIdsRef.current.has(parsed.id) ||
          pendingOutboundTaskIdsRef.current.has(parsed.taskId) ||
          directionRef.current === "outgoing" ||
          phaseRef.current === "outgoing" ||
          phaseRef.current === "idle" ||
          phaseRef.current === "connecting"
        ) {
          if (callIdRef.current && callIdRef.current !== parsed.id) {
            // Different call while we're already on one — ignore.
            if (phaseRef.current !== "idle") return;
          }
          applyOutboundRinging({
            ...parsed,
            customerName: resolveCustomerName(
              mergeCallPreserveName(callRef.current, parsed),
            ),
          });
          return;
        }
        // Don't flip a real inbound invite into outbound.
        if (phaseRef.current === "incoming") return;
        return;
      }

      if (name === "call.accepted" || name === "call.connected") {
        if (callIdRef.current && callIdRef.current !== parsed.id) return;
        stopIncomingRingtone();
        const merged = mergeCallPreserveName(callRef.current, parsed);
        setCall(merged);

        // Join once via agent-scoped POST /calls/:id/token (see ensureJoined).
        // accepted + connected may both fire; the LiveKit singleton de-dupes.
        if (isLivekitJoined(merged.id)) {
          setPhase("active");
          setConnectionLabel("Connected");
          if (!activeStartedRef.current) {
            activeStartedRef.current = Date.now();
          }
          return;
        }

        void ensureJoinedRef.current(merged);
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
  }, [connected, toast, applyOutboundRinging, resolveCustomerName]);

  // Wire remote <audio> + session UI callbacks once.
  useEffect(() => {
    setLivekitRemoteAudioElement(roomAudioRef.current);
    setLivekitSessionHandlers({
      onState: (label, active) => {
        setConnectionLabel(label);
        if (active) {
          setPhase("active");
          if (!activeStartedRef.current) {
            activeStartedRef.current = Date.now();
          }
        }
      },
    });
    return () => {
      setLivekitSessionHandlers({});
      // Intentionally do NOT disconnect LiveKit on unmount — React Strict Mode
      // remounts would drop a live call and cause DUPLICATE_IDENTITY on rejoin.
    };
  }, []);

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
    };
  }, []);

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

  const peer =
    call && direction
      ? resolveCustomerName(call)
      : "Customer";
  const taskHint = call
    ? [
        call.taskTitle,
        call.taskNumber != null ? `#${call.taskNumber}` : null,
        (() => {
          const task = liveTasksRef.current.find((t) => t.id === call.taskId);
          return task?.title && task.title !== call.taskTitle
            ? task.title
            : null;
        })(),
      ]
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(" · ")
    : "";

  const showIncoming =
    phase === "incoming" && direction === "incoming" && Boolean(call);
  const showOutboundBar =
    direction === "outgoing" ||
    phase === "outgoing" ||
    phase === "connecting" ||
    phase === "active" ||
    phase === "ending";

  return (
    <CallContext.Provider value={value}>
      {children}
      {/* Remote participant audio */}
      <audio
        ref={(el) => {
          roomAudioRef.current = el;
          setLivekitRemoteAudioElement(el);
        }}
        autoPlay
        playsInline
        className="hidden"
      />

      {showIncoming && call ? (
        <IncomingCallModal
          peerName={peer}
          taskHint={taskHint || "Support call"}
          callType={call.type}
          busy={busy}
          onAccept={() => void acceptIncoming()}
          onReject={() => void rejectIncoming()}
        />
      ) : null}

      {!showIncoming && showOutboundBar && call ? (
        <ActiveCallOverlay
          peerName={peer}
          taskHint={taskHint}
          mode={
            phase === "outgoing" ||
            (phase === "connecting" && direction === "outgoing")
              ? "outgoing"
              : phase === "connecting"
                ? "connecting"
                : phase === "ending"
                  ? "ending"
                  : "active"
          }
          statusLabel={
            phase === "outgoing" ||
            (phase === "connecting" && direction === "outgoing" && !isLivekitJoined())
              ? "Ringing… waiting for answer"
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
