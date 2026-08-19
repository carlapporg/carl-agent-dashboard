import Link from "next/link";
import type { BackendUser } from "@/types/user";
import { getAgentDisplayName } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";

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
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  );
}

export function ProfileDetails({ user }: { user: BackendUser }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg font-semibold text-accent"
            aria-hidden
          >
            {initials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {getAgentDisplayName(user)}
              </h2>
              <Badge variant="accent">{user.role}</Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
            <p className="mt-0.5 text-sm text-muted-dim">
              Member since {formatDate(user.createdAt)}
            </p>
          </div>
          <Link href={ROUTES.profileEdit} className="sm:ml-auto">
            <Button type="button" variant="secondary" className="w-full sm:w-auto">
              Edit profile
            </Button>
          </Link>
        </div>

        <dl className="mt-5 border-t border-border pt-1">
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
