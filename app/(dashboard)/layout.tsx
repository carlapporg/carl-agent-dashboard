import { redirect } from "next/navigation";
import { DashboardHeader } from "@/features/shell/components/header";
import { DashboardSidebar } from "@/features/shell/components/sidebar";
import { MobileNav } from "@/features/shell/components/mobile-nav";
import { DashboardWebSocketBridge } from "@/features/shell/components/dashboard-websocket-bridge";
import { logAuthEvent } from "@/lib/auth/audit-log";
import { getSession } from "@/lib/auth/session";
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

  return (
    <DashboardWebSocketBridge>
      <div className="app-shell flex min-h-dvh flex-1 flex-col bg-background lg:flex-row">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          <DashboardHeader user={session.user} />
          <main className="flex-1 p-4 md:p-5 lg:px-6 lg:py-6">{children}</main>
        </div>
      </div>
    </DashboardWebSocketBridge>
  );
}
