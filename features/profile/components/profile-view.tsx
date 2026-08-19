"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AvailabilityStub } from "@/features/profile/components/availability-stub";
import { ChangePasswordForm } from "@/features/profile/components/change-password-form";
import { EditNameForm } from "@/features/profile/components/edit-name-form";
import { ProfileDetails } from "@/features/profile/components/profile-details";
import { useAgentMe } from "@/features/agents/hooks";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { ROUTES } from "@/lib/constants/routes";
import type { BackendUser } from "@/types/user";
import { getAgentDisplayName } from "@/types/user";

type ProfileViewProps = {
  initialUser: BackendUser;
};

export function ProfileView({ initialUser }: ProfileViewProps) {
  const router = useRouter();
  const { data: user, isPending, isError, error, isFetching } =
    useAgentMe(initialUser);

  const current = user ?? initialUser;

  useEffect(() => {
    if (!isError || user) return;
    const message =
      error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("session") ||
      message.includes("sign in") ||
      message.includes("unauthorized")
    ) {
      router.replace(`${ROUTES.sessionClear}?reason=expired`);
    }
  }, [isError, error, user, router]);

  // Only block the page when we truly have nothing to show (avoid wipe on refetch errors).
  if (isPending && !current) {
    return (
      <PageShell wide>
        <PageSkeleton />
      </PageShell>
    );
  }

  if (!current) {
    return (
      <PageShell wide>
        <PageHeader title="Profile" />
        <EmptyState
          title="Profile unavailable"
          description={
            error instanceof Error
              ? error.message
              : "We couldn’t load your agent profile."
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        title="Profile"
        description={`${getAgentDisplayName(current)} · manage your agent account.${
          isFetching ? " Updating…" : ""
        }`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <ProfileDetails user={current} />

        <div className="space-y-4">
          <Card>
            <CardBody>
              <EditNameForm
                firstName={current.firstName ?? ""}
                lastName={current.lastName ?? ""}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <AvailabilityStub />
            </CardBody>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
