import { ROUTES } from "@/lib/constants/routes";

export const DASHBOARD_NAV = [
  { href: ROUTES.dashboard, label: "Overview" },
  { href: ROUTES.tasks, label: "Tasks" },
  { href: ROUTES.messages, label: "Messages" },
  { href: ROUTES.payments, label: "Payments" },
  { href: ROUTES.history, label: "History" },
  { href: ROUTES.notifications, label: "Notifications" },
  { href: ROUTES.settings, label: "Settings" },
] as const;
