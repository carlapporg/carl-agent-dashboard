import { redirect } from "next/navigation";
import { DashboardHeader } from "@/features/shell/components/header";
import { DashboardSidebar } from "@/features/shell/components/sidebar";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.unauthorized);
  }

  return (
    <div className="flex min-h-full flex-1 bg-background">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          userName={session.user.name}
          userEmail={session.user.email}
        />
        <main className="flex-1 p-6 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
