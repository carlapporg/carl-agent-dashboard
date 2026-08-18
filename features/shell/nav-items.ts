import { ROUTES } from "@/lib/constants/routes";

export const DASHBOARD_NAV = [
  { href: ROUTES.dashboard, label: "Overview" },
  { href: ROUTES.tasks, label: "Tasks" },
  { href: ROUTES.inbox, label: "Inbox" },
  { href: ROUTES.profile, label: "Profile" },
  { href: ROUTES.settings, label: "Settings" },
] as const;
