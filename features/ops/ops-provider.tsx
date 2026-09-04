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
import {
  getAvailabilityAction,
  setAvailabilityAction,
} from "@/features/agents/actions";
import {
  desiredPresenceForSession,
  normalizePresence,
} from "@/lib/agent/presence";
import { offerWasAccepted, isRejectingOrRejected } from "@/features/ops/auto-accept-offer";
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
  isKeptAfterMiss,
  isStatusDowngrade,
  liveStatusPatch,
  keepStatusOverlays,
  mergeByProgress,
  shouldIgnoreClosedSocketUpdate,
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
  parseReceiptNotification,
  parseWaitingForAgent,
} from "@/lib/notifications/from-events";
import { getOpenTasksAction } from "@/features/dashboard/actions";
import { parseIncomingTaskMessage, previewForIncomingMessage } from "@/lib/realtime/parse-task-message";
import {
  connectAgentSocket,
  emitAgentAvailability,
  ensureAgentSocketConnected,
  joinTaskRoom,
  leaveTaskRoom,
  releaseAgentSocket,
  updateAgentSocketAuth,
} from "@/lib/realtime/agent-socket";
import { ROUTES } from "@/lib/constants/routes";
import { parseTaskConfirmationPayload, type TaskConfirmation } from "@/types/confirmation";
import { parseTaskReceiptPayload, type TaskReceipt } from "@/types/receipt";
import {
  markTaskConfirmationKnown,
  markTaskReceiptKnown,
} from "@/lib/tasks/confirmation-presence";
import type { Task } from "@/types/task";
import type { Socket } from "socket.io-client";
import { markOfferAccepted } from "@/features/ops/auto-accept-offer";
import { useOfferAutoAssign } from "@/features/ops/offer-auto-assign";

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
  const raw =
    nested?.status ??
    nested?.taskStatus ??
    nested?.state ??
    data.status ??
    data.taskStatus ??
    data.state ??
    root.status;
  const parsed = agentTaskStatusSchema.safeParse(
    typeof raw === "string" ? raw.trim().toUpperCase().replace(/[\s-]+/g, "_") : raw,
  );
  return parsed.success ? parsed.data : undefined;
}

function syncOfferFromTask(current: Task | null, task: Task): Task | null {
  if (!current || current.id !== task.id) return current;
  const nextStatus = task.backendStatus;
  if (nextStatus === "ASSIGNED") {
    return {
      ...current,
      ...task,
      backendStatus: "ASSIGNED",
      status: "assigned",
      expiresAt: undefined,
      rejectUntil: null,
      canReject: false,
    };
  }
  if (nextStatus === "OFFERED") {
    return { ...current, ...task };
  }
  return null;
}

function extractOfferDeadline(payload: unknown): string | undefined {
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
  for (const source of [nested, data, root]) {
    if (!source) continue;
    for (const key of ["rejectUntil", "offerExpiresAt", "expiresAt"] as const) {
      const value = source[key];
      if (typeof value === "string" && value) {
        const time = new Date(value).getTime();
        if (Number.isFinite(time)) return new Date(time).toISOString();
      }
    }
  }
  return undefined;
}

function stubIncomingTask(
  taskId: string,
  payload: unknown,
  fallbackStatus: AgentTaskStatus = "OFFERED",
): Task {
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
  const serverDeadline = extractOfferDeadline(payload);
  const backendStatus = extractStatus(payload) ?? fallbackStatus;
  const isOffer = backendStatus === "OFFERED" || backendStatus === "QUEUED";
  const membershipRaw =
    data.membership && typeof data.membership === "object"
      ? (data.membership as Record<string, unknown>)
      : null;
  const meta =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : null;
  const brand =
    typeof membershipRaw?.brand === "string" ? membershipRaw.brand.trim() : "";
  const membershipId =
    typeof membershipRaw?.membershipId === "string"
      ? membershipRaw.membershipId.trim()
      : "";
  const taskType =
    (typeof data.taskType === "string" && data.taskType.trim()) ||
    (typeof data.type === "string" && data.type.trim()) ||
    undefined;

  return {
    id: taskId,
    number: 0,
    title,
    request: "",
    status: uiStatusFromAgent(backendStatus),
    priority: "normal",
    customerId: "Client",
    customerName: "Client",
    childIds: [],
    notes: [],
    suggestedStepsDone: [],
    createdAt: now,
    updatedAt: now,
    backendStatus,
    taskType,
    metadata: meta,
    membership: brand && membershipId ? { brand, membershipId } : null,
    expiresAt: isOffer
      ? (serverDeadline ?? new Date(Date.now() + 30_000).toISOString())
      : undefined,
    rejectUntil: isOffer ? (serverDeadline ?? null) : null,
  };
}

type LiveChatEvent = {
  at: number;
  taskId: string;
  sender: string;
  content: string;
  messageId?: string;
  mediaKind?: "text" | "voice" | "image";
  durationMs?: number | null;
};

type OpsContextValue = {
  connected: boolean;
  presence: AgentPresence;
  setPresence: (status: AgentPresence) => void;
  syncPresenceFromBackend: () => Promise<void>;
  offer: Task | null;
  liveTasks: Task[];
  dismissOffer: () => void;
  patchLiveTask: (taskId: string, patch: Partial<Task>, fallback?: Task) => void;
  dropLiveTask: (taskId: string) => void;
  hydrateOpenTasks: (tasks: Task[]) => void;
  silenceOffer: (taskId: string) => void;
  queuePulse: number;
  livePulse: boolean;
  liveChat: LiveChatEvent | null;
  liveConfirmation: TaskConfirmation | null;
  setLiveConfirmation: (row: TaskConfirmation | null) => void;
  liveReceipt: TaskReceipt | null;
  setLiveReceipt: (row: TaskReceipt | null) => void;
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

const CATCH_UP_MIN_MS = 15_000;
const CATCH_UP_AFTER_GAP_MS = 2_000;
let lastCatchUpAtMs = 0;
let catchUpInFlightGlobal = false;
let didInitialCatchUpGlobal = false;

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
  const [presence, setPresenceState] = useState<AgentPresence>(() =>
    normalizePresence(initialPresence ?? "AVAILABLE"),
  );
  const [offer, setOffer] = useState<Task | null>(null);
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [queuePulse, setQueuePulse] = useState(0);
  const [livePulse, setLivePulse] = useState(false);
  const [liveChat, setLiveChat] = useState<LiveChatEvent | null>(null);
  const [liveConfirmation, setLiveConfirmation] =
    useState<TaskConfirmation | null>(null);
  const [liveReceipt, setLiveReceipt] = useState<TaskReceipt | null>(null);
  const refreshTimer = useRef<number>(0);
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  const pausePresenceSyncUntil = useRef(0);

  const setPresence = useCallback((status: AgentPresence) => {
    pausePresenceSyncUntil.current = Date.now() + 4_000;
    setPresenceState(normalizePresence(status));
  }, []);

  const syncPresenceFromBackend = useCallback(async () => {
    if (Date.now() < pausePresenceSyncUntil.current) return;
    try {
      const row = await getAvailabilityAction();
      if (Date.now() < pausePresenceSyncUntil.current) return;
      const fromBackend = normalizePresence(row.status);
      const desired = desiredPresenceForSession(fromBackend);
      if (desired !== fromBackend) {
        // Nest often flips to OFFLINE when the socket drops (refresh / blip).
        pausePresenceSyncUntil.current = Date.now() + 4_000;
        setPresenceState(desired);
        void setAvailabilityAction(desired)
          .then((next) => {
            setPresenceState(normalizePresence(next.status));
          })
          .catch(() => undefined);
        return;
      }
      setPresenceState(fromBackend);
    } catch {
      // Keep the last known value when the API is unreachable.
    }
  }, []);

  const syncPresenceRef = useRef(syncPresenceFromBackend);
  syncPresenceRef.current = syncPresenceFromBackend;

  useEffect(() => {
    // Prefer Available on dashboard entry; Nest OFFLINE from a dropped socket is restored.
    const desired = desiredPresenceForSession(
      normalizePresence(initialPresence ?? "AVAILABLE"),
    );
    setPresenceState(desired);
  }, [initialPresence]);

  useEffect(() => {
    void syncPresenceFromBackend();
  }, [syncPresenceFromBackend]);

  const refresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      router.refresh();
    }, 350);
  }, [router]);

  const pulseQueue = useCallback(() => {
    setQueuePulse((n) => n + 1);
    setLivePulse(true);
    window.setTimeout(() => setLivePulse(false), 1600);
  }, []);

  const dismissOffer = useCallback(() => setOffer(null), []);

  const silenceOffer = useCallback((taskId: string) => {
    if (socketRef.current) leaveTaskRoom(socketRef.current, taskId);
    notificationsRef.current.dismiss(`offer:${taskId}`);
    setOffer((current) => (current?.id === taskId ? null : current));
  }, []);

  const dropLiveTask = useCallback((taskId: string) => {
    silenceOffer(taskId);
    setLiveTasks((prev) => prev.filter((row) => row.id !== taskId));
    pulseQueue();
  }, [pulseQueue, silenceOffer]);

  const hydrateOpenTasks = useCallback((tasks: Task[]) => {
    didInitialCatchUpGlobal = true;
    if (tasks.length === 0) return;
    let changed = false;
    setLiveTasks((prev) => {
      const byId = new Map(prev.map((row) => [row.id, row]));
      for (const task of tasks) {
        if (isRejectingOrRejected(task.id)) continue;
        const existing = byId.get(task.id);
        if (!existing) {
          byId.set(task.id, task);
          changed = true;
          continue;
        }
        if (
          existing.backendStatus === task.backendStatus &&
          existing.status === task.status &&
          existing.updatedAt === task.updatedAt
        ) {
          continue;
        }
        const next = keepStatusOverlays(existing, mergeByProgress(existing, task));
        byId.set(task.id, next);
        changed = true;
      }
      return changed ? [...byId.values()] : prev;
    });
    if (changed) pulseQueue();
  }, [pulseQueue]);

  const upsertLiveTask = useCallback((task: Task) => {
    if (isRejectingOrRejected(task.id)) return;
    if (task.backendStatus === "ASSIGNED") {
      markOfferAccepted(task.id);
    }
    const prior = liveTasksRef.current.find((row) => row.id === task.id);
    const statusChanged =
      !prior ||
      prior.backendStatus !== task.backendStatus ||
      prior.status !== task.status;
    setLiveTasks((prev) => {
      const index = prev.findIndex((row) => row.id === task.id);
      if (index === -1) return [task, ...prev];
      const merged = keepStatusOverlays(prev[index], mergeByProgress(prev[index], task));
      if (
        merged.backendStatus === prev[index].backendStatus &&
        merged.status === prev[index].status &&
        merged.updatedAt === prev[index].updatedAt &&
        merged.title === prev[index].title
      ) {
        return prev;
      }
      const next = [...prev];
      next[index] = merged;
      return next;
    });
    setOffer((current) => syncOfferFromTask(current, task));
    if (statusChanged) pulseQueue();
  }, [pulseQueue]);

  const patchLiveTask = useCallback((taskId: string, patch: Partial<Task>, fallback?: Task) => {
    const nextStatus = patch.backendStatus;
    if (nextStatus === "ASSIGNED") {
      markOfferAccepted(taskId);
    }
    if (isRejectingOrRejected(taskId) && nextStatus !== "ASSIGNED") return;
    const extras = {
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    let statusChanged = Boolean(patch.backendStatus || patch.status);
    setLiveTasks((prev) => {
      const index = prev.findIndex((row) => row.id === taskId);
      if (index === -1) {
        if (!fallback) return prev;
        return [
          keepStatusOverlays(fallback, mergeByProgress(fallback, { ...fallback, ...extras })),
          ...prev,
        ];
      }
      const current = prev[index];
      if (isStatusDowngrade(current, extras)) return prev;
      statusChanged =
        (patch.backendStatus != null &&
          patch.backendStatus !== current.backendStatus) ||
        (patch.status != null && patch.status !== current.status);
      const next = [...prev];
      next[index] = keepStatusOverlays(
        current,
        mergeByProgress(current, {
          ...current,
          ...extras,
        }),
      );
      return next;
    });
    setOffer((current) => {
      if (!current || current.id !== taskId) return current;
      const offerNextStatus = extras.backendStatus ?? current.backendStatus;
      if (offerNextStatus && offerNextStatus !== "OFFERED" && offerNextStatus !== "ASSIGNED") {
        return null;
      }
      if (offerNextStatus === "ASSIGNED") {
        return syncOfferFromTask(current, { ...current, ...extras } as Task);
      }
      return { ...current, ...extras };
    });
    if (statusChanged) pulseQueue();
  }, [pulseQueue]);

  const upsertLiveTaskRef = useRef(upsertLiveTask);
  upsertLiveTaskRef.current = upsertLiveTask;
  const patchLiveTaskRef = useRef(patchLiveTask);
  patchLiveTaskRef.current = patchLiveTask;
  const silenceOfferRef = useRef(silenceOffer);
  silenceOfferRef.current = silenceOffer;
  const setLiveConfirmationRef = useRef(setLiveConfirmation);
  setLiveConfirmationRef.current = setLiveConfirmation;
  const setLiveReceiptRef = useRef(setLiveReceipt);
  setLiveReceiptRef.current = setLiveReceipt;
  const liveTasksRef = useRef(liveTasks);
  liveTasksRef.current = liveTasks;
  const offerRef = useRef(offer);
  offerRef.current = offer;
  const socketTokenRef = useRef(socketToken);
  socketTokenRef.current = socketToken;

  const autoAssignTasks = useMemo(() => {
    const byId = new Map<string, Task>();
    for (const row of liveTasks) byId.set(row.id, row);
    if (offer) byId.set(offer.id, offer);
    return [...byId.values()];
  }, [liveTasks, offer]);

  useOfferAutoAssign({
    tasks: autoAssignTasks,
    patchLiveTask,
    dropLiveTask,
    refresh,
  });

  useEffect(() => {
    setSocketToken(accessToken);
  }, [accessToken]);

  useEffect(() => subscribeAccessToken(setSocketToken), []);

  useEffect(() => {
    if (!socketToken) return;
    updateAgentSocketAuth(socketToken);
  }, [socketToken]);

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

  const socketReady = Boolean(socketUrl && socketToken);

  useEffect(() => {
    if (!socketReady) return;

    const socket = connectAgentSocket(socketUrl, socketTokenRef.current);
    socketRef.current = socket;
    let lastAuthRefresh = 0;
    let cancelled = false;
    let hydrated = didInitialCatchUpGlobal;
    let disconnectedAt = 0;
    let dropBannerTimer = 0;
    let catchUpTimer = 0;
    const seenIds = new Set<string>();

    function rejoinRooms() {
      const ids = new Set<string>();
      const viewingId = taskIdFromPath(pathnameRef.current);
      if (viewingId) ids.add(viewingId);
      if (offerRef.current?.id) ids.add(offerRef.current.id);
      for (const row of liveTasksRef.current) ids.add(row.id);
      for (const id of ids) {
        if (!isRejectingOrRejected(id)) joinTaskRoom(socket, id);
      }
    }

    async function refreshAuth(): Promise<string | null> {
      const now = Date.now();
      if (now - lastAuthRefresh < 4_000) return socketTokenRef.current || null;
      lastAuthRefresh = now;
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) return null;
        const token = accessTokenFromUnknown(await response.json());
        if (!token) return null;
        publishAccessToken(token);
        updateAgentSocketAuth(token);
        return token;
      } catch {
        return null;
      }
    }

    async function catchUpQueue() {
      if (cancelled) return;
      const now = Date.now();
      if (lastCatchUpAtMs !== 0 && now - lastCatchUpAtMs < CATCH_UP_MIN_MS) return;
      if (catchUpInFlightGlobal) return;
      catchUpInFlightGlobal = true;
      try {
        const fetchedAt = Date.now();
        const tasks = await getOpenTasksAction();
        if (cancelled) return;
        lastCatchUpAtMs = Date.now();
        const known = new Set(seenIds);
        for (const row of liveTasksRef.current) known.add(row.id);
        const newOffers: Task[] = [];
        for (const task of tasks) {
          if (isRejectingOrRejected(task.id)) continue;
          const unknown = !known.has(task.id);
          known.add(task.id);
          seenIds.add(task.id);
          upsertLiveTaskRef.current(task);
          joinTaskRoom(socket, task.id);
          if (task.backendStatus === "OFFERED" && unknown) {
            newOffers.push(task);
          }
        }
        if (newOffers.length > 0 && hydrated) {
          const next = newOffers[0];
          if (next) {
            setOffer((current) => current ?? next);
            notificationsRef.current.push(notificationFromOffer(next));
            playNotificationChime();
            pulseQueue();
          }
        }
        hydrated = true;
        didInitialCatchUpGlobal = true;
        const backendIds = new Set(tasks.map((task) => task.id));
        setLiveTasks((prev) =>
          prev.filter((row) => {
            if (backendIds.has(row.id) || isRejectingOrRejected(row.id)) {
              return true;
            }
            const rowAt = new Date(row.updatedAt).getTime();
            return Number.isFinite(rowAt) && rowAt >= fetchedAt;
          }),
        );
        setOffer((current) => {
          if (!current) return current;
          if (backendIds.has(current.id) || isRejectingOrRejected(current.id)) {
            return current;
          }
          return null;
        });
        rejoinRooms();
      } catch {
        lastCatchUpAtMs = 0;
      } finally {
        catchUpInFlightGlobal = false;
      }
    }

    function requestCatchUp() {
      window.clearTimeout(catchUpTimer);
      catchUpTimer = window.setTimeout(() => {
        if (!cancelled) void catchUpQueue();
      }, 80);
    }

    function registerPresenceWithNest() {
      const status = desiredPresenceForSession(presenceRef.current);
      setPresenceState(status);
      presenceRef.current = status;
      emitAgentAvailability(status);
      // Nest dispatch needs AVAILABLE/BUSY + an active socketId.
      void setAvailabilityAction(status)
        .then((row) => {
          if (cancelled) return;
          pausePresenceSyncUntil.current = Date.now() + 4_000;
          const synced = normalizePresence(row.status);
          setPresenceState(synced);
          presenceRef.current = synced;
        })
        .catch(() => undefined);
    }

    function onConnect() {
      window.clearTimeout(dropBannerTimer);
      setConnected(true);
      rejoinRooms();
      registerPresenceWithNest();
      const gap = disconnectedAt ? Date.now() - disconnectedAt : 0;
      disconnectedAt = 0;
      if (gap >= CATCH_UP_AFTER_GAP_MS) {
        requestCatchUp();
      }
    }

    function onDisconnect(reason: string) {
      if (!disconnectedAt) disconnectedAt = Date.now();
      window.clearTimeout(dropBannerTimer);
      // Mark down immediately so local + production UI stay consistent.
      setConnected(false);
      dropBannerTimer = window.setTimeout(() => {
        if (cancelled || socket.connected) return;
        setConnected(false);
      }, 1_500);
      if (reason === "io server disconnect") {
        void refreshAuth().finally(() => {
          if (!cancelled && !socket.connected && !socket.active) {
            socket.connect();
          }
        });
      }
    }

    function forgetIfRejecting(taskId: string | undefined): boolean {
      if (!taskId || !isRejectingOrRejected(taskId)) return false;
      silenceOfferRef.current(taskId);
      return true;
    }

    function onIncomingTask(payload: unknown, eventName?: string) {
      const mapped = mapSocketAssignedPayload(payload);
      const fallbackStatus: AgentTaskStatus = eventName?.includes("assigned")
        ? "ASSIGNED"
        : "OFFERED";
      const task =
        mapped ??
        (() => {
          const id = extractTaskId(payload);
          return id ? stubIncomingTask(id, payload, fallbackStatus) : null;
        })();
      if (!task) {
        pulseQueue();
        return;
      }
      if (forgetIfRejecting(task.id)) return;
      const alreadyKnown = liveTasksRef.current.some((row) => row.id === task.id);
      if (!alreadyKnown) {
        joinTaskRoom(socket, task.id);
        if (task.backendStatus === "OFFERED") {
          setOffer((current) => current ?? task);
          notificationsRef.current.push(notificationFromOffer(task));
          playNotificationChime();
        }
      } else if (task.backendStatus === "OFFERED" && !isRejectingOrRejected(task.id)) {
        setOffer((current) =>
          current?.id === task.id ? task : (current ?? task),
        );
      }
      if (task.backendStatus === "ASSIGNED") {
        setOffer((current) => syncOfferFromTask(current, task));
      }
      upsertLiveTaskRef.current(task);
      pulseQueue();
    }

    function onMessage(payload: unknown) {
      const incoming = parseIncomingTaskMessage(payload);
      if (!incoming) return;
      if (isRejectingOrRejected(incoming.taskId)) return;
      joinTaskRoom(socket, incoming.taskId);
      if (incoming.sender === "USER") {
        setLiveChat({
          at: Date.now(),
          taskId: incoming.taskId,
          sender: incoming.sender,
          content: incoming.content,
          messageId: incoming.messageId,
          mediaKind: incoming.mediaKind,
          durationMs: incoming.durationMs,
        });
      }
      if (incoming.sender !== "USER") return;
      if (notificationsRef.current.isViewingTaskInbox(incoming.taskId)) return;
      const preview = previewForIncomingMessage(incoming);
      notificationsRef.current.push(
        notificationFromClientMessage({
          taskId: incoming.taskId,
          content: preview,
          clientLabel: incoming.clientLabel,
          taskTitle: incoming.taskTitle,
          messageId: incoming.messageId,
        }),
      );
      playNotificationChime();
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
        patchLiveTaskRef.current(id, liveStatusPatch("FAILED", "failed"));
        setOffer((current) => (current?.id === id ? null : current));
      }
      toastRef.current("A task failed.", "info", { title: "Task failed" });
      pulseQueue();
    }

    function onPaymentApproved(payload: unknown) {
      const item = parsePaymentNotification(payload, "payment_approved");
      if (item) notificationsRef.current.push(item);
      pulseQueue();
    }

    function onPaymentDeclined(payload: unknown) {
      const item = parsePaymentNotification(payload, "payment_declined");
      if (item) notificationsRef.current.push(item);
      pulseQueue();
    }

    function onPaymentExpired(payload: unknown) {
      const item = parsePaymentNotification(payload, "payment_expired");
      if (item) notificationsRef.current.push(item);
      pulseQueue();
    }

    function onConfirmationConfirmed(payload: unknown) {
      const confirmation = parseTaskConfirmationPayload(payload);
      if (confirmation) {
        markTaskConfirmationKnown(confirmation.taskId);
        setLiveConfirmationRef.current(confirmation);
      }
      const id =
        confirmation?.taskId ??
        parseConfirmationNotification(payload, "confirmation_confirmed")?.taskId ??
        extractTaskId(payload);
      if (id) {
        markTaskConfirmationKnown(id);
        patchLiveTaskRef.current(
          id,
          liveStatusPatch("WAITING_FOR_USER", "waiting_for_payment"),
        );
      }
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
    }

    function onConfirmationDeclined(payload: unknown) {
      const confirmation = parseTaskConfirmationPayload(payload);
      if (confirmation) {
        markTaskConfirmationKnown(confirmation.taskId);
        setLiveConfirmationRef.current(confirmation);
      }
      const id =
        confirmation?.taskId ??
        parseConfirmationNotification(payload, "confirmation_declined")?.taskId ??
        extractTaskId(payload);
      if (id) {
        markTaskConfirmationKnown(id);
        patchLiveTaskRef.current(
          id,
          liveStatusPatch("IN_PROGRESS", "in_progress"),
        );
      }
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
    }

    function onReceiptAccepted(payload: unknown) {
      const receipt = parseTaskReceiptPayload(payload);
      if (receipt) {
        markTaskReceiptKnown(receipt.taskId);
        setLiveReceiptRef.current(receipt);
      }
      const item = parseReceiptNotification(payload, "receipt_accepted");
      if (item) {
        if (item.taskId) markTaskReceiptKnown(item.taskId);
        notificationsRef.current.push(item);
        toastRef.current(item.body, "success", {
          title: item.title,
          href: item.taskId ? ROUTES.taskPanel(item.taskId, "receipt") : undefined,
          actionLabel: "Open task",
        });
        playNotificationChime();
      }
      pulseQueue();
    }

    function onReceiptRejected(payload: unknown) {
      const receipt = parseTaskReceiptPayload(payload);
      if (receipt) {
        markTaskReceiptKnown(receipt.taskId);
        setLiveReceiptRef.current(receipt);
      }
      const item = parseReceiptNotification(payload, "receipt_rejected");
      if (item) {
        if (item.taskId) markTaskReceiptKnown(item.taskId);
        notificationsRef.current.push(item);
        toastRef.current(item.body, "info", {
          title: item.title,
          href: item.taskId ? ROUTES.taskPanel(item.taskId, "receipt") : undefined,
          actionLabel: "Open task",
        });
        playNotificationChime();
      }
      pulseQueue();
    }

    function onStatusChanged(payload: unknown) {
      const mapped = mapSocketAssignedPayload(payload);
      const id = mapped?.id ?? extractTaskId(payload);
      if (forgetIfRejecting(id)) return;
      const live = id
        ? liveTasksRef.current.find((row) => row.id === id)
        : undefined;
      const status = mapped?.backendStatus ?? extractStatus(payload);
      if (
        shouldIgnoreClosedSocketUpdate(live, mapped, status) ||
        (id &&
          offerWasAccepted(id) &&
          (status === "FAILED" || status === "REJECTED") &&
          (!mapped || mapped.title === "Task" || mapped.title === "New task offered"))
      ) {
        return;
      }
      if (mapped) {
        upsertLiveTaskRef.current(mapped);
      } else {
        if (id && status) {
          const current = liveTasksRef.current.find((row) => row.id === id);
          if (
            shouldIgnoreClosedSocketUpdate(current, null, status)
          ) {
            return;
          }
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
    }

    function onMissed(payload: unknown) {
      const item = parseMissedTask(payload);
      const id = item?.taskId ?? extractTaskId(payload);
      if (forgetIfRejecting(id)) return;
      const live = id
        ? liveTasksRef.current.find((row) => row.id === id)
        : undefined;
      if (id && (offerWasAccepted(id) || (live && isKeptAfterMiss(live)))) {
        return;
      }
      if (item) notificationsRef.current.push(item);
      if (id) {
        setLiveTasks((prev) => prev.filter((row) => row.id !== id));
        setOffer((current) => (current?.id === id ? null : current));
      }
      pulseQueue();
    }

    function onQueuePulse() {
      pulseQueue();
    }

    function onTaskUpdated(payload: unknown) {
      const mapped = mapSocketAssignedPayload(payload);
      const id = mapped?.id ?? extractTaskId(payload);
      if (forgetIfRejecting(id)) return;
      const live = id
        ? liveTasksRef.current.find((row) => row.id === id)
        : undefined;
      if (shouldIgnoreClosedSocketUpdate(live, mapped, mapped?.backendStatus)) {
        return;
      }
      if (mapped) upsertLiveTaskRef.current(mapped);
      pulseQueue();
    }

    function onConnectError(error: unknown) {
      setConnected(false);
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error ?? "");
      if (!/auth|unauthorized|jwt|token|forbidden/i.test(message)) return;
      void refreshAuth().then((token) => {
        if (!token || cancelled) return;
        if (!socket.connected && !socket.active) socket.connect();
      });
    }

    function onVisibleOrOnline() {
      if (document.visibilityState === "hidden") return;
      ensureAgentSocketConnected();
      void syncPresenceRef.current();
    }

    function onForcedOffline() {
      void syncPresenceRef.current();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    if (socket.connected) onConnect();

    document.addEventListener("visibilitychange", onVisibleOrOnline);
    window.addEventListener("online", onVisibleOrOnline);
    window.addEventListener("pageshow", onVisibleOrOnline);

    for (const eventName of TASK_INCOMING_EVENTS) {
      socket.on(eventName, (payload: unknown) => onIncomingTask(payload, eventName));
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
    socket.on("task.receipt_accepted", onReceiptAccepted);
    socket.on("task_receipt_accepted", onReceiptAccepted);
    socket.on("task.receipt_rejected", onReceiptRejected);
    socket.on("task_receipt_rejected", onReceiptRejected);
    socket.on("task.status_changed", onStatusChanged);
    socket.on("task_status_changed", onStatusChanged);
    socket.on("task.missed", onMissed);
    socket.on("task_missed", onMissed);
    socket.on("task.updated", onTaskUpdated);
    socket.on("task_updated", onTaskUpdated);
    socket.on("queue.updated", onQueuePulse);
    socket.on("queue_updated", onQueuePulse);
    socket.on("agent.forced_offline", onForcedOffline);
    socket.on("agent_forced_offline", onForcedOffline);

    return () => {
      cancelled = true;
      window.clearTimeout(dropBannerTimer);
      window.clearTimeout(catchUpTimer);
      document.removeEventListener("visibilitychange", onVisibleOrOnline);
      window.removeEventListener("online", onVisibleOrOnline);
      window.removeEventListener("pageshow", onVisibleOrOnline);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      for (const eventName of TASK_INCOMING_EVENTS) {
        socket.off(eventName);
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
      socket.off("task.receipt_accepted", onReceiptAccepted);
      socket.off("task_receipt_accepted", onReceiptAccepted);
      socket.off("task.receipt_rejected", onReceiptRejected);
      socket.off("task_receipt_rejected", onReceiptRejected);
      socket.off("task.status_changed", onStatusChanged);
      socket.off("task_status_changed", onStatusChanged);
      socket.off("task.missed", onMissed);
      socket.off("task_missed", onMissed);
      socket.off("task.updated", onTaskUpdated);
      socket.off("task_updated", onTaskUpdated);
      socket.off("queue.updated", onQueuePulse);
      socket.off("queue_updated", onQueuePulse);
      socket.off("agent.forced_offline", onForcedOffline);
      socket.off("agent_forced_offline", onForcedOffline);
      releaseAgentSocket();
    };
  }, [socketUrl, socketReady]);

  useEffect(() => {
    const viewingId = openTaskId ?? taskIdFromPath(pathname);
    if (!viewingId || !socketRef.current?.connected) return;
    if (isRejectingOrRejected(viewingId)) return;
    joinTaskRoom(socketRef.current, viewingId);
  }, [openTaskId, pathname]);

  const value = useMemo<OpsContextValue>(
    () => ({
      connected,
      presence,
      setPresence,
      syncPresenceFromBackend,
      offer,
      liveTasks,
      dismissOffer,
      patchLiveTask,
      dropLiveTask,
      hydrateOpenTasks,
      silenceOffer,
      queuePulse,
      livePulse,
      liveChat,
      liveConfirmation,
      setLiveConfirmation,
      liveReceipt,
      setLiveReceipt,
      refresh,
    }),
    [
      connected,
      dismissOffer,
      dropLiveTask,
      hydrateOpenTasks,
      liveChat,
      liveConfirmation,
      liveReceipt,
      livePulse,
      liveTasks,
      offer,
      patchLiveTask,
      presence,
      queuePulse,
      refresh,
      setLiveConfirmation,
      setLiveReceipt,
      setPresence,
      syncPresenceFromBackend,
      silenceOffer,
    ],
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
