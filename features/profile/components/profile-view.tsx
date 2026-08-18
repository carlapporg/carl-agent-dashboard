"use client";

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
import { getAgentDisplayName } from "@/types/user";

export function ProfileView() {
  const { data: user, isPending, isError, error, isFetching } = useAgentMe();

  if (isPending) {
    return (
      <PageShell wide>
        <PageSkeleton />
      </PageShell>
    );
  }

  if (isError || !user) {
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
        description={`${getAgentDisplayName(user)} · manage your agent account.${
          isFetching ? " Updating…" : ""
        }`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <ProfileDetails user={user} />

        <div className="space-y-6">
          <Card>
            <CardBody className="p-6 md:p-8">
              <EditNameForm
                firstName={user.firstName ?? ""}
                lastName={user.lastName ?? ""}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6 md:p-8">
              <ChangePasswordForm />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6 md:p-8">
              <AvailabilityStub />
            </CardBody>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
