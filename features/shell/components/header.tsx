"use client";

import { useState, useTransition } from "react";
import { logoutAction } from "@/features/auth/actions/auth";
import { useAgentMe, useClearAppCache } from "@/features/agents/hooks";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BackendUser } from "@/types/user";
import { getAgentDisplayName } from "@/types/user";

type DashboardHeaderProps = {
  user: BackendUser;
};

function initials(user: BackendUser): string {
  const first = user.firstName?.trim()?.[0] ?? "";
  const last = user.lastName?.trim()?.[0] ?? "";
  const value = `${first}${last}`.toUpperCase();
  return value || user.email.slice(0, 2).toUpperCase();
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { data } = useAgentMe(user);
  const clearCache = useClearAppCache();
  const current = data ?? user;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const name = getAgentDisplayName(current);

  return (
    <>
      <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-5 md:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
            Agent Dashboard
          </p>
          <p className="mt-0.5 truncate text-base text-muted">
            Signed in as {current.email}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 md:gap-4">
          <div className="hidden items-center gap-3 rounded-xl border border-border bg-surface-hover/60 px-3 py-2 sm:flex">
            <div
              className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
              aria-hidden
            >
              {initials(current)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {name}
              </p>
              <p className="text-sm text-muted">Agent</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
          >
            Sign out
          </Button>
        </div>
      </header>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Sign out?"
        description="You’ll need to sign in again to continue working on tasks."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        destructive
        loading={pending}
        onConfirm={() => {
          clearCache();
          startTransition(() => {
            void logoutAction();
          });
        }}
      />
    </>
  );
}
