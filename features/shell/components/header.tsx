import { logoutAction } from "@/features/auth/actions/auth";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  userName: string;
  userEmail: string;
};

export function DashboardHeader({ userName, userEmail }: DashboardHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface/80 px-5 backdrop-blur-sm md:px-8">
      <div>
        <p className="text-base font-medium text-foreground md:text-lg">
          Agent Dashboard
        </p>
        <p className="text-sm text-muted">Signed in as {userEmail}</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden text-base text-foreground-soft sm:inline">
          {userName}
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
