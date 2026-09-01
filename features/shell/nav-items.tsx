import { ROUTES } from "@/lib/constants/routes";
import type { ReactNode } from "react";

export type NavIconId =
  | "overview"
  | "tasks"
  | "messages"
  | "adminChat"
  | "payments"
  | "history"
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
  { href: ROUTES.adminChat, label: "Admin chat", icon: "adminChat" },
  { href: ROUTES.payments, label: "Payments", icon: "payments" },
  { href: ROUTES.history, label: "History", icon: "history" },
  { href: ROUTES.notifications, label: "Notifications", icon: "notifications" },
  { href: ROUTES.profile, label: "Profile", icon: "profile" },
  { href: ROUTES.settings, label: "Settings", icon: "settings" },
];

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
    case "history":
      return strokeIcon(
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
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
