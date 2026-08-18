import type { BackendUser } from "@/types/user";
import { getAgentDisplayName } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function initials(user: BackendUser): string {
  const first = user.firstName?.trim()?.[0] ?? "";
  const last = user.lastName?.trim()?.[0] ?? "";
  const value = `${first}${last}`.toUpperCase();
  return value || user.email.slice(0, 2).toUpperCase();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="text-base font-semibold text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  );
}

export function ProfileDetails({ user }: { user: BackendUser }) {
  return (
    <Card>
      <CardBody className="p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-2xl font-semibold text-accent"
            aria-hidden
          >
            {initials(user)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {getAgentDisplayName(user)}
              </h2>
              <Badge variant="accent">{user.role}</Badge>
            </div>
            <p className="mt-1.5 truncate text-base text-muted">{user.email}</p>
            <p className="mt-1 text-base text-muted-dim">
              Member since {formatDate(user.createdAt)}
            </p>
          </div>
        </div>

        <dl className="mt-8 border-t border-border pt-2">
          <Row label="First name" value={user.firstName?.trim() || "—"} />
          <Row label="Last name" value={user.lastName?.trim() || "—"} />
          <Row label="Email" value={user.email} />
          <Row label="Account type" value={user.accountType ?? "—"} />
          <Row
            label="Email verified"
            value={user.isEmailVerified ? "Verified" : "Not verified"}
          />
          <Row label="Family" value={user.familyId ?? "—"} />
          <Row label="Last updated" value={formatDate(user.updatedAt)} />
        </dl>
      </CardBody>
    </Card>
  );
}
