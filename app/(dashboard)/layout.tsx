import { redirect } from "next/navigation";
import { DashboardHeader } from "@/features/shell/components/header";
import { DashboardSidebar } from "@/features/shell/components/sidebar";
import { MobileNav } from "@/features/shell/components/mobile-nav";
import { DashboardWebSocketBridge } from "@/features/shell/components/dashboard-websocket-bridge";
import { AgentSocketProvider } from "@/features/shell/components/agent-socket-provider";
import { PageChromeProvider } from "@/features/shell/page-chrome";
import { NotificationProvider } from "@/features/notifications/notification-provider";
import { agentsApi } from "@/lib/api/agents";
import { normalizePresence } from "@/lib/agent/presence";
import { logAuthEvent } from "@/lib/auth/audit-log";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { ROUTES } from "@/lib/constants/routes";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    logAuthEvent("unauthorized_access", { reason: "no_session" });
    redirect(ROUTES.login);
  }

  if (session.user.role !== "AGENT") {
    redirect(`${ROUTES.sessionClear}?reason=wrong_role`);
  }

  let initialPresence = normalizePresence("AVAILABLE");
  try {
    const row = await agentsApi.getAvailability();
    initialPresence = normalizePresence(row.status);
  } catch {
    // Client will retry via getAvailabilityAction.
  }

  return (
    <DashboardWebSocketBridge>
      <NotificationProvider>
      <AgentSocketProvider
        socketUrl={env.socketUrl}
        accessToken={session.accessToken}
        initialPresence={initialPresence}
      >
      <PageChromeProvider>
      <div className="app-shell flex min-h-dvh flex-1 flex-col bg-background lg:flex-row">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          <DashboardHeader user={session.user} />
          <main className="flex-1 p-5 md:p-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      </PageChromeProvider>
      </AgentSocketProvider>
      </NotificationProvider>
    </DashboardWebSocketBridge>
  );
}
