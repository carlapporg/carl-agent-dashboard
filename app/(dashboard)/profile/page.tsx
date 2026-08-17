import type { Metadata } from "next";
import { AvailabilityStub } from "@/features/profile/components/availability-stub";
import { ChangePasswordForm } from "@/features/profile/components/change-password-form";
import { EditNameForm } from "@/features/profile/components/edit-name-form";
import { agentsApi } from "@/lib/api/agents";
import { getSession } from "@/lib/auth/session";
import { getAgentDisplayName } from "@/types/user";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await getSession();
  let user = session?.user;

  try {
    user = await agentsApi.me();
  } catch {
    // Fall back to session user if API unavailable.
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-2 text-base text-muted">
          {getAgentDisplayName(user)} · manage your agent account.
        </p>
      </header>

      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-surface p-6">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="text-foreground-soft">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Role</dt>
              <dd className="text-foreground-soft">{user.role}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <EditNameForm
            firstName={user.firstName ?? ""}
            lastName={user.lastName ?? ""}
          />
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <ChangePasswordForm />
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <AvailabilityStub />
        </section>
      </div>
    </div>
  );
}
