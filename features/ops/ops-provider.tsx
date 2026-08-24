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
import { getAvailabilityAction } from "@/features/agents/actions";
import { useToast } from "@/components/providers/toast-provider";
import { mapSocketAssignedPayload } from "@/lib/api/map-task";
import { parseIncomingTaskMessage } from "@/lib/realtime/parse-task-message";
import { connectAgentSocket, joinTaskRoom } from "@/lib/realtime/agent-socket";
import { ROUTES } from "@/lib/constants/routes";
import type { AgentPresence } from "@/types/agent";
import type { Task } from "@/types/task";
import type { Socket } from "socket.io-client";

function taskIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/tasks\/([^/]+)/);
  return match?.[1];
}

type OpsContextValue = {
  connected: boolean;
  presence: AgentPresence;
  setPresence: (status: AgentPresence) => void;
  offer: Task | null;
  dismissOffer: () => void;
  queuePulse: number;
  livePulse: boolean;
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
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<AgentPresence>(
    initialPresence ?? "ONLINE",
  );
  const [offer, setOffer] = useState<Task | null>(null);
  const [queuePulse, setQueuePulse] = useState(0);
  const [livePulse, setLivePulse] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const dismissOffer = useCallback(() => setOffer(null), []);

  useEffect(() => {
    if (initialPresence) {
      setPresence(initialPresence);
    }
  }, [initialPresence]);

  const syncPresence = useCallback(() => {
    void getAvailabilityAction()
      .then((row) => setPresence(row.status))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!socketUrl || !accessToken) return;

    const socket = connectAgentSocket(socketUrl, accessToken);
    socketRef.current = socket;

    function pulseQueue() {
      setQueuePulse((n) => n + 1);
      setLivePulse(true);
      window.setTimeout(() => setLivePulse(false), 1600);
    }

    socket.on("connect", () => {
      setConnected(true);
      const viewingId = openTaskId ?? taskIdFromPath(pathnameRef.current);
      if (viewingId) joinTaskRoom(socket, viewingId);
      if (!initialPresence) syncPresence();
      refresh();
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    function onAssigned(payload: unknown) {
      const task = mapSocketAssignedPayload(payload);
      if (task) {
        setOffer(task);
        joinTaskRoom(socket, task.id);
      }
      setPresence("BUSY");
      pulseQueue();
      refresh();
    }

    function onMessage(payload: unknown) {
      const incoming = parseIncomingTaskMessage(payload);
      refresh();
      if (!incoming) return;
      joinTaskRoom(socket, incoming.taskId);
      if (incoming.sender !== "USER") return;
      const viewingId =
        openTaskId ?? taskIdFromPath(pathnameRef.current);
      if (viewingId === incoming.taskId) return;
      const preview =
        incoming.content.length > 90
          ? `${incoming.content.slice(0, 87)}…`
          : incoming.content;
      const lines = [
        incoming.clientLabel,
        preview,
        incoming.taskTitle,
      ].filter(Boolean);
      toast(lines.join("\n"), "info", {
        placement: "top",
        title: "New client message",
        href: ROUTES.taskPanel(incoming.taskId, "chat"),
        actionLabel: "Open conversation",
        stack: true,
      });
    }

    function onCancelled() {
      toast("A task was cancelled.", "info", { title: "Task cancelled" });
      pulseQueue();
      refresh();
    }

    socket.on("task.assigned", onAssigned);
    socket.on("task_assigned", onAssigned);
    socket.on("task.message", onMessage);
    socket.on("task_message", onMessage);
    socket.on("task.cancelled", onCancelled);
    socket.on("task_cancelled", onCancelled);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, openTaskId, refresh, socketUrl, syncPresence, toast]);

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
      dismissOffer,
      queuePulse,
      livePulse,
      refresh,
    }),
    [connected, dismissOffer, livePulse, offer, presence, queuePulse, refresh],
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
