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
import { usePathname } from "next/navigation";
import { hrefForNotification } from "@/lib/notifications/from-events";
import { getAlertsAction } from "@/features/dashboard/actions";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_PREFS_KEY,
  readNotificationPrefs,
  writeNotificationPrefs,
} from "@/lib/notifications/prefs";
import {
  playNotificationChime,
  unlockNotificationAudio,
} from "@/lib/notifications/sound";
import {
  mergeNotification,
  NOTIFICATION_STORE_KEY,
  readNotifications,
  writeNotifications,
} from "@/lib/notifications/store";
import type {
  NotificationItem,
  NotificationKind,
  NotificationPrefs,
} from "@/types/dashboard";

type PushOptions = {
  silent?: boolean;
};

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  prefs: NotificationPrefs;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  push: (
    item: Omit<NotificationItem, "read">,
    options?: PushOptions,
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  setPrefs: (next: NotificationPrefs) => void;
  isViewingTaskInbox: (taskId: string) => boolean;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

function kindAllowed(kind: NotificationKind, prefs: NotificationPrefs): boolean {
  switch (kind) {
    case "task_offered":
    case "task_assigned":
    case "missed_task":
      return prefs.taskAssigned;
    case "client_message":
      return prefs.customerReply;
    case "waiting_for_agent":
      return prefs.slaWarning;
    case "payment_approved":
    case "payment_declined":
    case "payment_expired":
      return prefs.paymentResult;
    case "task_cancelled":
      return true;
    case "confirmation_confirmed":
    case "confirmation_declined":
      return true;
    default:
      return true;
  }
}

function showDesktopNotification(item: NotificationItem) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    const href = hrefForNotification(item);
    const note = new Notification(item.title, {
      body: item.body,
      tag: item.id,
    });
    note.onclick = () => {
      window.focus();
      window.location.assign(href);
      note.close();
    };
  } catch {
    // Browser blocked it.
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [prefs, setPrefsState] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const panelOpenRef = useRef(false);
  const prefsRef = useRef(prefs);
  panelOpenRef.current = panelOpen;
  prefsRef.current = prefs;

  useEffect(() => {
    setItems(readNotifications());
    setPrefsState(readNotificationPrefs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    function unlock() {
      unlockNotificationAudio();
    }
    const opts = { capture: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("click", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
      window.removeEventListener("click", unlock, opts);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeNotifications(items);
  }, [hydrated, items]);

  useEffect(() => {
    if (!hydrated) return;
    writeNotificationPrefs(prefs);
  }, [hydrated, prefs]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === NOTIFICATION_STORE_KEY) {
        setItems(readNotifications());
      }
      if (event.key === NOTIFICATION_PREFS_KEY) {
        setPrefsState(readNotificationPrefs());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPanelOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [panelOpen]);

  const isViewingTaskInbox = useCallback((taskId: string) => {
    const path = pathnameRef.current;
    return path === `/tasks/${taskId}` || path.startsWith(`/tasks/${taskId}/`);
  }, []);

  const push = useCallback(
    (incoming: Omit<NotificationItem, "read">, options?: PushOptions) => {
      if (!kindAllowed(incoming.kind, prefsRef.current)) return;
      const item: NotificationItem = { ...incoming, read: false };
      setItems((prev) => {
        const existing = prev.find((row) => row.id === item.id);
        if (existing) {
          if (options?.silent) return prev;
          if (
            existing.body === item.body &&
            existing.title === item.title &&
            existing.read === false
          ) {
            return prev;
          }
        }
        return mergeNotification(prev, item);
      });
      if (options?.silent) return;
      if (prefsRef.current.sound) {
        playNotificationChime();
      }
      if (prefsRef.current.desktop) {
        showDesktopNotification(item);
      }
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setPrefs = useCallback((next: NotificationPrefs) => {
    setPrefsState(next);
    if (next.desktop && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
    if (next.sound) unlockNotificationAudio();
  }, []);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  useEffect(() => {
    if (!hydrated) return;
    void getAlertsAction()
      .then((alerts) => {
        for (const alert of alerts) {
          push(
            {
              id: alert.taskId ? `offer:${alert.taskId}` : alert.id,
              kind: "task_offered",
              title: alert.title,
              body: alert.body,
              createdAt: alert.createdAt,
              taskId: alert.taskId,
              panel: alert.panel,
            },
            { silent: true },
          );
        }
      })
      .catch(() => undefined);
  }, [hydrated, push]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount,
      prefs,
      panelOpen,
      setPanelOpen,
      push,
      markRead,
      markAllRead,
      dismiss,
      setPrefs,
      isViewingTaskInbox,
    }),
    [
      dismiss,
      isViewingTaskInbox,
      items,
      markAllRead,
      markRead,
      panelOpen,
      prefs,
      push,
      setPrefs,
      unreadCount,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
