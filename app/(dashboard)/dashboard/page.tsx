import type { Metadata } from "next";
import { DashboardPageClient } from "@/features/dashboard/components/dashboard-page-client";
import { PageShell } from "@/components/ui/page-shell";
import { getSession } from "@/lib/auth/session";
import { getAgentDisplayName } from "@/types/user";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const session = await getSession();
  const welcomeName = session ? getAgentDisplayName(session.user) : "there";

  return (
    <PageShell wide>
      <DashboardPageClient welcomeName={welcomeName} />
    </PageShell>
  );
}
