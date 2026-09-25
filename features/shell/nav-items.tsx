import { ROUTES } from "@/lib/constants/routes";
import type { ReactNode } from "react";

export type NavIconId =
  | "overview"
  | "tasks"
  | "messages"
  | "adminChat"
  | "payments"
  | "earnings"
  | "payouts"
  | "history"
  | "workDiary"
  | "calendar"
  | "notifications"
  | "profile"
  | "settings";

export const DASHBOARD_NAV: Array<{
  href: string;
  label: string;
  icon: NavIconId;
}> = [
  { href: ROUTES.dashboard, label: "Overview", icon: "overview" },
  { href: ROUTES.tasks, label: "Tasks", icon: "tasks" },
  { href: ROUTES.messages, label: "Messages", icon: "messages" },
  { href: ROUTES.adminChat, label: "Support Tickets", icon: "adminChat" },
  { href: ROUTES.earnings, label: "Earnings", icon: "earnings" },
  { href: ROUTES.payoutSettings, label: "Payout Settings", icon: "payouts" },
  { href: ROUTES.history, label: "History", icon: "history" },
  // Work Diary is redundant — Timesheet already shows the same hours.
  // { href: ROUTES.workDiary, label: "Work Diary", icon: "workDiary" },
  { href: ROUTES.timesheet, label: "Timesheet", icon: "calendar" },
  { href: ROUTES.notifications, label: "Notifications", icon: "notifications" },
  { href: ROUTES.profile, label: "Profile", icon: "profile" },
  { href: ROUTES.settings, label: "Settings", icon: "settings" },
];

/** Figma Side Menu order (extra routes stay reachable elsewhere). */
const FIGMA_PRIMARY_HREFS = new Set<string>([
  ROUTES.dashboard,
  ROUTES.tasks,
  ROUTES.messages,
  ROUTES.adminChat,
  ROUTES.earnings,
  ROUTES.payoutSettings,
  ROUTES.history,
  // ROUTES.workDiary,
  ROUTES.timesheet,
  ROUTES.notifications,
  ROUTES.profile,
]);

export const PRIMARY_NAV = DASHBOARD_NAV.filter((item) =>
  FIGMA_PRIMARY_HREFS.has(item.href),
);

export const SETTINGS_NAV_ITEM = DASHBOARD_NAV.find(
  (item) => item.href === ROUTES.settings,
);

/** Display labels matching Figma Side Menu. */
export function navDisplayLabel(href: string, fallback: string): string {
  if (href === ROUTES.dashboard) return "Dashboard";
  if (href === ROUTES.tasks) return "Task";
  if (href === ROUTES.adminChat) return "Support Tickets";
  if (href === ROUTES.payments) return "Payments";
  if (href === ROUTES.earnings) return "Earnings";
  if (href === ROUTES.payoutSettings) return "Payout Settings";
  // if (href === ROUTES.workDiary) return "Work Diary";
  if (href === ROUTES.timesheet) return "Timesheet";
  if (href === ROUTES.notifications) return "Notifications";
  return fallback;
}

function strokeIcon(paths: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5 shrink-0"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );
}

export function NavIcon({ id }: { id: NavIconId }) {
  switch (id) {
    case "overview":
      return strokeIcon(
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>,
      );
    case "tasks":
      return strokeIcon(
        <>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </>,
      );
    case "messages":
      return strokeIcon(
        <>
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        </>,
      );
    case "adminChat":
      return strokeIcon(
        <>
          <path d="M8 10h8M8 14h5" />
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        </>,
      );
    case "payments":
      return strokeIcon(
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </>,
      );
    case "earnings":
      return strokeIcon(
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M9.5 9.5c.6-.8 1.4-1.2 2.5-1.2 1.6 0 2.6.9 2.6 2.1 0 2.6-5.2 1.4-5.2 4 0 1.2 1.1 2.1 2.6 2.1 1.1 0 2-.4 2.6-1.2" />
        </>,
      );
    case "payouts":
      return strokeIcon(
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </>,
      );
    case "history":
      return strokeIcon(
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </>,
      );
    case "workDiary":
      return strokeIcon(
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
          <path d="M8 14h3M13 14h3M8 17h3" />
        </>,
      );
    case "calendar":
      return strokeIcon(
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
          <path d="M8 15h2M12 15h2M16 15h2M8 18h2M12 18h2" />
        </>,
      );
    case "notifications":
      return strokeIcon(
        <>
          <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </>,
      );
    case "profile":
      return strokeIcon(
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </>,
      );
    case "settings":
      return strokeIcon(
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>,
      );
    default:
      return null;
  }
}
