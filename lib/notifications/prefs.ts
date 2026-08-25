import { readLocalJson, writeLocalJson } from "@/lib/tasks/local-store";
import type { NotificationPrefs } from "@/types/dashboard";

export const NOTIFICATION_PREFS_KEY = "carl.agent.notification-prefs";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  taskAssigned: true,
  paymentResult: true,
  slaWarning: true,
  customerReply: true,
  desktop: false,
  sound: true,
};

function isBool(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function readNotificationPrefs(): NotificationPrefs {
  const stored = readLocalJson<Partial<NotificationPrefs> | null>(
    NOTIFICATION_PREFS_KEY,
    null,
  );
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  return {
    taskAssigned: isBool(stored.taskAssigned)
      ? stored.taskAssigned
      : DEFAULT_NOTIFICATION_PREFS.taskAssigned,
    paymentResult: isBool(stored.paymentResult)
      ? stored.paymentResult
      : DEFAULT_NOTIFICATION_PREFS.paymentResult,
    slaWarning: isBool(stored.slaWarning)
      ? stored.slaWarning
      : DEFAULT_NOTIFICATION_PREFS.slaWarning,
    customerReply: isBool(stored.customerReply)
      ? stored.customerReply
      : DEFAULT_NOTIFICATION_PREFS.customerReply,
    desktop: isBool(stored.desktop)
      ? stored.desktop
      : DEFAULT_NOTIFICATION_PREFS.desktop,
    sound: isBool(stored.sound) ? stored.sound : DEFAULT_NOTIFICATION_PREFS.sound,
  };
}

export function writeNotificationPrefs(prefs: NotificationPrefs) {
  writeLocalJson(NOTIFICATION_PREFS_KEY, prefs);
}
