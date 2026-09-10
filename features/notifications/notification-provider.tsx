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
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import { hrefForNotification } from "@/lib/notifications/from-events";
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
  /** Full list for History (includes bell-cleared items). */
  items: NotificationItem[];
  /** Bell tray only — excludes items cleared with × on the icon. */
  bellItems: NotificationItem[];
  unreadCount: number;
  prefs: NotificationPrefs;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  push: (
    item: Omit<NotificationItem, "read"> & { read?: boolean },
    options?: PushOptions,
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Clear from bell tray only — stays in History. */
  dismiss: (id: string) => void;
  /** Permanent remove from History (and bell). */
  removeFromHistory: (id: string) => void;
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
    case "task_failed":
      return true;
    case "confirmation_confirmed":
    case "confirmation_declined":
    case "receipt_accepted":
    case "receipt_rejected":
      return true;
    default:
      return true;
  }
}

function sortNewest(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function mergeRemoteWithLocal(
  remote: NotificationItem[],
  local: NotificationItem[],
): NotificationItem[] {
  const localById = new Map(local.map((row) => [row.id, row]));
  const byId = new Map<string, NotificationItem>();
  for (const row of remote) {
    const prev = localById.get(row.id);
    byId.set(
      row.id,
      prev?.hiddenFromBell
        ? { ...row, hiddenFromBell: true, read: true }
        : prev
          ? { ...row, read: row.read || prev.read }
          : row,
    );
  }
  for (const row of local) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return sortNewest([...byId.values()]);
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
    let cancelled = false;
    setPrefsState(readNotificationPrefs());
    const local = readNotifications();
    setItems(local);
    setHydrated(true);

    void listNotificationsAction(50)
      .then((remote) => {
        if (cancelled) return;
        setItems((prev) => mergeRemoteWithLocal(remote, prev));
      })
      .catch(() => {
        // Keep in-memory / socket-pushed items if the list API is down.
      });

    return () => {
      cancelled = true;
    };
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
    (
      incoming: Omit<NotificationItem, "read"> & { read?: boolean },
      options?: PushOptions,
    ) => {
      if (!kindAllowed(incoming.kind, prefsRef.current)) return;
      const item: NotificationItem = {
        ...incoming,
        read: incoming.read === true,
      };
      setItems((prev) => {
        const existing = prev.find((row) => row.id === item.id);
        if (existing) {
          if (options?.silent) return prev;
          if (
            existing.body === item.body &&
            existing.title === item.title &&
            existing.read === item.read
          ) {
            return prev;
          }
        }
        return mergeNotification(prev, item);
      });
      if (options?.silent || item.read) return;
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
    void markNotificationReadAction(id).catch(() => {
      // Optimistic UI; retry on next open if needed.
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    void markAllNotificationsReadAction().catch(() => {
      // Optimistic UI.
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    // Bell × only clears the tray — History keeps the row.
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, hiddenFromBell: true, read: true }
          : item,
      ),
    );
    void markNotificationReadAction(id).catch(() => {});
  }, []);

  const removeFromHistory = useCallback((id: string) => {
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

  const bellItems = useMemo(
    () => items.filter((item) => !item.hiddenFromBell),
    [items],
  );

  const unreadCount = useMemo(
    () => bellItems.filter((item) => !item.read).length,
    [bellItems],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      bellItems,
      unreadCount,
      prefs,
      panelOpen,
      setPanelOpen,
      push,
      markRead,
      markAllRead,
      dismiss,
      removeFromHistory,
      setPrefs,
      isViewingTaskInbox,
    }),
    [
      bellItems,
      dismiss,
      isViewingTaskInbox,
      items,
      markAllRead,
      markRead,
      panelOpen,
      prefs,
      push,
      removeFromHistory,
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
