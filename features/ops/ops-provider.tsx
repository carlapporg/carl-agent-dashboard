"use client";

import { usePathname, useRouter } from "next/navigation";
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
import { setAvailabilityAction } from "@/features/agents/actions";
import { offerWasAccepted } from "@/features/ops/auto-accept-offer";
import { useNotifications } from "@/features/notifications/notification-provider";
import { useToast } from "@/components/providers/toast-provider";
import { mapSocketAssignedPayload, uiStatusFromAgent } from "@/lib/api/map-task";
import {
  accessTokenFromUnknown,
  publishAccessToken,
  subscribeAccessToken,
} from "@/lib/auth/access-token-bus";
import { readJwtExpiryMs } from "@/lib/auth/access-jwt";
import {
  readChosenPresence,
  writeChosenPresence,
} from "@/lib/agent/presence";
import {
  isKeptAfterMiss,
  liveStatusPatch,
  mergeByProgress,
} from "@/lib/tasks/merge-live-task";
import { playNotificationChime } from "@/lib/notifications/sound";
import { agentTaskStatusSchema, type AgentPresence, type AgentTaskStatus } from "@/types/agent";
import {
  notificationFromClientMessage,
  notificationFromOffer,
  parseCancelledNotification,
  parseConfirmationNotification,
  parseMissedTask,
  parsePaymentNotification,
  parseWaitingForAgent,
} from "@/lib/notifications/from-events";
import { parseIncomingTaskMessage } from "@/lib/realtime/parse-task-message";
import { connectAgentSocket, joinTaskRoom } from "@/lib/realtime/agent-socket";
import { ROUTES } from "@/lib/constants/routes";
import { parseTaskConfirmationPayload, type TaskConfirmation } from "@/types/confirmation";
import type { Task } from "@/types/task";
import type { Socket } from "socket.io-client";

function taskIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/tasks\/([^/]+)/);
  return match?.[1];
}

function extractTaskId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const nested =
    data.task && typeof data.task === "object"
      ? (data.task as Record<string, unknown>)
      : null;
  const id = data.taskId ?? data.id ?? nested?.id ?? nested?.taskId ?? root.taskId;
  return typeof id === "string" && id ? id : typeof id === "number" ? String(id) : undefined;
}

function extractStatus(payload: unknown): AgentTaskStatus | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const nested =
    data.task && typeof data.task === "object"
      ? (data.task as Record<string, unknown>)
      : null;
  const raw = data.status ?? nested?.status ?? root.status;
  const parsed = agentTaskStatusSchema.safeParse(
    typeof raw === "string" ? raw.trim().toUpperCase().replace(/[\s-]+/g, "_") : raw,
  );
  return parsed.success ? parsed.data : undefined;
}

function stubOffer(taskId: string, payload: unknown): Task {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const title =
    (typeof data.title === "string" && data.title) || "New task offered";
  const now = new Date().toISOString();
  return {
    id: taskId,
    number: 0,
    title,
    request: "",
    status: "queued",
    priority: "normal",
    customerId: "Client",
    customerName: "Client",
    childIds: [],
    notes: [],
    suggestedStepsDone: [],
    createdAt: now,
    updatedAt: now,
    backendStatus: "OFFERED",
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };
}

type LiveChatEvent = {
  at: number;
  taskId: string;
  sender: string;
  content: string;
};

type OpsContextValue = {
  connected: boolean;
  presence: AgentPresence;
  setPresence: (status: AgentPresence) => void;
  offer: Task | null;
  liveTasks: Task[];
  dismissOffer: () => void;
  patchLiveTask: (taskId: string, patch: Partial<Task>, fallback?: Task) => void;
  queuePulse: number;
  livePulse: boolean;
  liveChat: LiveChatEvent | null;
  liveConfirmation: TaskConfirmation | null;
  setLiveConfirmation: (row: TaskConfirmation | null) => void;
  refresh: () => void;
};

const OpsContext = createContext<OpsContextValue | null>(null);

export function useOps() {
  return useContext(OpsContext);
}

type AgentOpsProviderProps = {
  children: ReactNode;
  socketUrl: string;
  accessToken: string;
  openTaskId?: string;
  initialPresence?: AgentPresence;
};

const TASK_INCOMING_EVENTS = [
  "task.offered",
  "task_offered",
  "task.created",
  "task_created",
  "task.assigned",
  "task_assigned",
] as const;

export function AgentOpsProvider({
  children,
  socketUrl,
  accessToken,
  openTaskId,
  initialPresence,
}: AgentOpsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { toast } = useToast();
  const notifications = useNotifications();
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const socketRef = useRef<Socket | null>(null);
  const [socketToken, setSocketToken] = useState(accessToken);
  const [connected, setConnected] = useState(false);
  const [presence, setPresenceState] = useState<AgentPresence>(
    initialPresence ?? "ONLINE",
  );
  const [offer, setOffer] = useState<Task | null>(null);
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [queuePulse, setQueuePulse] = useState(0);
  const [livePulse, setLivePulse] = useState(false);
  const [liveChat, setLiveChat] = useState<LiveChatEvent | null>(null);
  const [liveConfirmation, setLiveConfirmation] =
    useState<TaskConfirmation | null>(null);
  const refreshTimer = useRef<number>(0);
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  const setPresence = useCallback((status: AgentPresence) => {
    setPresenceState(status);
  }, []);

  const refresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      router.refresh();
    }, 350);
  }, [router]);

  const refreshLists = useCallback(() => {
    refresh();
  }, [refresh]);

  const dismissOffer = useCallback(() => setOffer(null), []);

  const upsertLiveTask = useCallback((task: Task) => {
    setLiveTasks((prev) => {
      const index = prev.findIndex((row) => row.id === task.id);
      if (index === -1) return [task, ...prev];
      const next = [...prev];
      next[index] = mergeByProgress(next[index], task);
      return next;
    });
  }, []);

  const patchLiveTask = useCallback((taskId: string, patch: Partial<Task>, fallback?: Task) => {
    const extras = {
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    setLiveTasks((prev) => {
      const index = prev.findIndex((row) => row.id === taskId);
      if (index === -1) {
        if (!fallback) return prev;
        return [
          mergeByProgress(fallback, { ...fallback, ...extras }),
          ...prev,
        ];
      }
      const next = [...prev];
      next[index] = mergeByProgress(next[index], {
        ...next[index],
        ...extras,
      });
      return next;
    });
    setOffer((current) => {
      if (!current || current.id !== taskId) return current;
      const nextStatus = extras.backendStatus ?? current.backendStatus;
      if (nextStatus && nextStatus !== "OFFERED" && nextStatus !== "ASSIGNED") {
        return null;
      }
      return { ...current, ...extras };
    });
  }, []);

  const refreshListsRef = useRef(refreshLists);
  refreshListsRef.current = refreshLists;
  const upsertLiveTaskRef = useRef(upsertLiveTask);
  upsertLiveTaskRef.current = upsertLiveTask;
  const patchLiveTaskRef = useRef(patchLiveTask);
  patchLiveTaskRef.current = patchLiveTask;
  const setLiveConfirmationRef = useRef(setLiveConfirmation);
  setLiveConfirmationRef.current = setLiveConfirmation;
  const liveTasksRef = useRef(liveTasks);
  liveTasksRef.current = liveTasks;

  useEffect(() => {
    const chosen = readChosenPresence();
    if (initialPresence && initialPresence !== "OFFLINE") {
      setPresenceState(initialPresence);
      if (!chosen) writeChosenPresence(initialPresence);
      return;
    }
    if (chosen && chosen !== "OFFLINE") {
      setPresenceState(chosen);
      void setAvailabilityAction(chosen)
        .then((row) => setPresenceState(row.status))
        .catch(() => undefined);
      return;
    }
    if (initialPresence) setPresenceState(initialPresence);
  }, [initialPresence]);

  useEffect(() => {
    setSocketToken(accessToken);
  }, [accessToken]);

  useEffect(() => subscribeAccessToken(setSocketToken), []);

  useEffect(() => {
    if (!socketToken) return;
    const expMs = readJwtExpiryMs(socketToken);
    if (expMs == null) return;
    const wait = Math.max(5_000, expMs - Date.now() - 90_000);
    const id = window.setTimeout(() => {
      void fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      })
        .then(async (response) => {
          if (!response.ok) return;
          const token = accessTokenFromUnknown(await response.json());
          if (token) publishAccessToken(token);
        })
        .catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(id);
  }, [socketToken]);

  useEffect(() => {
    if (!socketUrl || !socketToken) return;

    const socket = connectAgentSocket(socketUrl, socketToken);
    socketRef.current = socket;
    let lastAuthRefresh = 0;

    function pulseQueue() {
      setQueuePulse((n) => n + 1);
      setLivePulse(true);
      window.setTimeout(() => setLivePulse(false), 1600);
    }

    function reassertPresence() {
      const chosen = readChosenPresence();
      if (chosen === "OFFLINE") return;
      const restore =
        chosen ??
        (presenceRef.current !== "OFFLINE" ? presenceRef.current : "AVAILABLE");
      writeChosenPresence(restore);
      void setAvailabilityAction(restore)
        .then((row) => setPresenceState(row.status))
        .catch(() => undefined);
    }

    function onConnect() {
      setConnected(true);
      const viewingId = taskIdFromPath(pathnameRef.current);
      if (viewingId) joinTaskRoom(socket, viewingId);
      reassertPresence();
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onIncomingTask(payload: unknown) {
      const mapped = mapSocketAssignedPayload(payload);
      const task =
        mapped ??
        (() => {
          const id = extractTaskId(payload);
          return id ? stubOffer(id, payload) : null;
        })();
      if (task) {
        setOffer(task);
        upsertLiveTaskRef.current(task);
        joinTaskRoom(socket, task.id);
        notificationsRef.current.push(notificationFromOffer(task));
        playNotificationChime();
      }
      pulseQueue();
      refreshListsRef.current();
    }

    function onMessage(payload: unknown) {
      const incoming = parseIncomingTaskMessage(payload);
      if (!incoming) return;
      joinTaskRoom(socket, incoming.taskId);
      if (incoming.sender === "USER") {
        setLiveChat({
          at: Date.now(),
          taskId: incoming.taskId,
          sender: incoming.sender,
          content: incoming.content,
        });
      }
      if (incoming.sender !== "USER") return;
      if (notificationsRef.current.isViewingTaskInbox(incoming.taskId)) return;
      notificationsRef.current.push(
        notificationFromClientMessage({
          taskId: incoming.taskId,
          content: incoming.content,
          clientLabel: incoming.clientLabel,
          taskTitle: incoming.taskTitle,
        }),
      );
      playNotificationChime();
      const preview =
        incoming.content.length > 90
          ? `${incoming.content.slice(0, 87)}…`
          : incoming.content;
      const lines = [
        incoming.clientLabel,
        preview,
        incoming.taskTitle,
      ].filter(Boolean);
      toastRef.current(lines.join("\n"), "info", {
        placement: "top",
        title: "New client message",
        href: ROUTES.taskPanel(incoming.taskId, "chat"),
        actionLabel: "Open conversation",
        stack: true,
      });
    }

    function onCancelled(payload: unknown) {
      const item = parseCancelledNotification(payload);
      if (item) notificationsRef.current.push(item);
      const id = item?.taskId ?? extractTaskId(payload);
      if (id) {
        patchLiveTaskRef.current(id, liveStatusPatch("CANCELLED", "cancelled"));
        setOffer((current) => (current?.id === id ? null : current));
      }
      toastRef.current("A task was cancelled.", "info", { title: "Task cancelled" });
      pulseQueue();
      refreshListsRef.current();
    }

    function onPaymentApproved(payload: unknown) {
      const item = parsePaymentNotification(payload, "payment_approved");
      if (item) notificationsRef.current.push(item);
      pulseQueue();
      refreshListsRef.current();
    }

    function onPaymentDeclined(payload: unknown) {
      const item = parsePaymentNotification(payload, "payment_declined");
      if (item) notificationsRef.current.push(item);
      pulseQueue();
      refreshListsRef.current();
    }

    function onPaymentExpired(payload: unknown) {
      const item = parsePaymentNotification(payload, "payment_expired");
      if (item) notificationsRef.current.push(item);
      pulseQueue();
      refreshListsRef.current();
    }

    function onConfirmationConfirmed(payload: unknown) {
      const confirmation = parseTaskConfirmationPayload(payload);
      if (confirmation) setLiveConfirmationRef.current(confirmation);
      const item = parseConfirmationNotification(payload, "confirmation_confirmed");
      if (item) {
        notificationsRef.current.push(item);
        toastRef.current(item.body, "success", {
          title: item.title,
          href: item.taskId ? ROUTES.task(item.taskId) : undefined,
          actionLabel: "Open task",
        });
        playNotificationChime();
      }
      pulseQueue();
      refreshListsRef.current();
    }

    function onConfirmationDeclined(payload: unknown) {
      const confirmation = parseTaskConfirmationPayload(payload);
      if (confirmation) setLiveConfirmationRef.current(confirmation);
      const item = parseConfirmationNotification(payload, "confirmation_declined");
      if (item) {
        notificationsRef.current.push(item);
        toastRef.current(item.body, "info", {
          title: item.title,
          href: item.taskId ? ROUTES.task(item.taskId) : undefined,
          actionLabel: "Open task",
        });
        playNotificationChime();
      }
      pulseQueue();
      refreshListsRef.current();
    }

    function onStatusChanged(payload: unknown) {
      const mapped = mapSocketAssignedPayload(payload);
      if (mapped) {
        upsertLiveTaskRef.current(mapped);
      } else {
        const id = extractTaskId(payload);
        const status = extractStatus(payload);
        if (id && status) {
          patchLiveTaskRef.current(id, {
            backendStatus: status,
            status: uiStatusFromAgent(status),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      const item = parseWaitingForAgent(payload);
      if (item && !notificationsRef.current.isViewingTaskInbox(item.taskId ?? "")) {
        notificationsRef.current.push(item);
      }
      pulseQueue();
      refreshListsRef.current();
    }

    function onMissed(payload: unknown) {
      const item = parseMissedTask(payload);
      const id = item?.taskId ?? extractTaskId(payload);
      const live = id
        ? liveTasksRef.current.find((row) => row.id === id)
        : undefined;
      if (id && (offerWasAccepted(id) || (live && isKeptAfterMiss(live)))) {
        pulseQueue();
        refreshListsRef.current();
        return;
      }
      if (item) notificationsRef.current.push(item);
      if (id) {
        setLiveTasks((prev) => prev.filter((row) => row.id !== id));
        setOffer((current) => (current?.id === id ? null : current));
      }
      pulseQueue();
      refreshListsRef.current();
    }

    function onQueuePulse() {
      pulseQueue();
      refreshListsRef.current();
    }

    function onTaskUpdated(payload: unknown) {
      const mapped = mapSocketAssignedPayload(payload);
      if (mapped) upsertLiveTaskRef.current(mapped);
      pulseQueue();
      refreshListsRef.current();
    }

    function onConnectError(error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error ?? "");
      if (!/auth|unauthorized|jwt|token|forbidden/i.test(message)) return;
      const now = Date.now();
      if (now - lastAuthRefresh < 4_000) return;
      lastAuthRefresh = now;
      void fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      })
        .then(async (response) => {
          if (!response.ok) return;
          const token = accessTokenFromUnknown(await response.json());
          if (token) publishAccessToken(token);
        })
        .catch(() => undefined);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    if (socket.connected) onConnect();

    for (const eventName of TASK_INCOMING_EVENTS) {
      socket.on(eventName, onIncomingTask);
    }
    socket.on("task.message", onMessage);
    socket.on("task_message", onMessage);
    socket.on("task.cancelled", onCancelled);
    socket.on("task_cancelled", onCancelled);
    socket.on("payment.approved", onPaymentApproved);
    socket.on("payment_approved", onPaymentApproved);
    socket.on("payment.declined", onPaymentDeclined);
    socket.on("payment_declined", onPaymentDeclined);
    socket.on("payment.rejected", onPaymentDeclined);
    socket.on("payment_rejected", onPaymentDeclined);
    socket.on("payment.expired", onPaymentExpired);
    socket.on("payment_expired", onPaymentExpired);
    socket.on("task.confirmation_confirmed", onConfirmationConfirmed);
    socket.on("task_confirmation_confirmed", onConfirmationConfirmed);
    socket.on("task.confirmation_declined", onConfirmationDeclined);
    socket.on("task_confirmation_declined", onConfirmationDeclined);
    socket.on("task.status_changed", onStatusChanged);
    socket.on("task_status_changed", onStatusChanged);
    socket.on("task.missed", onMissed);
    socket.on("task_missed", onMissed);
    socket.on("task.updated", onTaskUpdated);
    socket.on("task_updated", onTaskUpdated);
    socket.on("queue.updated", onQueuePulse);
    socket.on("queue_updated", onQueuePulse);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      for (const eventName of TASK_INCOMING_EVENTS) {
        socket.off(eventName, onIncomingTask);
      }
      socket.off("task.message", onMessage);
      socket.off("task_message", onMessage);
      socket.off("task.cancelled", onCancelled);
      socket.off("task_cancelled", onCancelled);
      socket.off("payment.approved", onPaymentApproved);
      socket.off("payment_approved", onPaymentApproved);
      socket.off("payment.declined", onPaymentDeclined);
      socket.off("payment_declined", onPaymentDeclined);
      socket.off("payment.rejected", onPaymentDeclined);
      socket.off("payment_rejected", onPaymentDeclined);
      socket.off("payment.expired", onPaymentExpired);
      socket.off("payment_expired", onPaymentExpired);
      socket.off("task.confirmation_confirmed", onConfirmationConfirmed);
      socket.off("task_confirmation_confirmed", onConfirmationConfirmed);
      socket.off("task.confirmation_declined", onConfirmationDeclined);
      socket.off("task_confirmation_declined", onConfirmationDeclined);
      socket.off("task.status_changed", onStatusChanged);
      socket.off("task_status_changed", onStatusChanged);
      socket.off("task.missed", onMissed);
      socket.off("task_missed", onMissed);
      socket.off("task.updated", onTaskUpdated);
      socket.off("task_updated", onTaskUpdated);
      socket.off("queue.updated", onQueuePulse);
      socket.off("queue_updated", onQueuePulse);
    };
  }, [socketToken, socketUrl]);

  useEffect(() => {
    const viewingId = openTaskId ?? taskIdFromPath(pathname);
    if (!viewingId || !socketRef.current?.connected) return;
    joinTaskRoom(socketRef.current, viewingId);
  }, [openTaskId, pathname]);

  const value = useMemo<OpsContextValue>(
    () => ({
      connected,
      presence,
      setPresence,
      offer,
      liveTasks,
      dismissOffer,
      patchLiveTask,
      queuePulse,
      livePulse,
      liveChat,
      liveConfirmation,
      setLiveConfirmation,
      refresh,
    }),
    [
      connected,
      dismissOffer,
      liveChat,
      liveConfirmation,
      livePulse,
      liveTasks,
      offer,
      patchLiveTask,
      presence,
      queuePulse,
      refresh,
      setLiveConfirmation,
      setPresence,
    ],
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
