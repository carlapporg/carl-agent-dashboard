import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";

type CustomerRailProps = {
  profile: CustomerProfile;
  history: CustomerHistoryItem[];
};

function RailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </CardBody>
    </Card>
  );
}

export function CustomerRail({ profile, history }: CustomerRailProps) {
  return (
    <aside className="space-y-4">
      <RailCard title="Customer">
        <p className="text-lg font-semibold text-foreground">{profile.name}</p>
        <p className="mt-1 text-base text-muted">{profile.email}</p>
        {profile.phone ? (
          <p className="text-base text-muted">{profile.phone}</p>
        ) : null}
        {profile.notes ? (
          <p className="mt-3 text-base leading-relaxed text-foreground-soft">
            {profile.notes}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted-dim">
          Member since {new Date(profile.memberSince).toLocaleDateString()}
        </p>
      </RailCard>

      <RailCard title="Preferences">
        <ul className="space-y-2">
          {profile.preferences.map((pref) => (
            <li key={pref.key} className="text-base">
              <span className="text-muted">{pref.key}: </span>
              <span className="font-medium text-foreground-soft">
                {pref.value}
              </span>
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="Spending rules">
        <dl className="space-y-2 text-base">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Auto-approve under</dt>
            <dd className="font-semibold text-foreground">
              ${profile.spendingRules.autoApproveUnder}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Monthly limit</dt>
            <dd className="font-semibold text-foreground">
              ${profile.spendingRules.monthlyLimit.toLocaleString()}
            </dd>
          </div>
        </dl>
      </RailCard>

      <RailCard title="Payment methods">
        <ul className="space-y-2 text-base text-foreground-soft">
          {profile.paymentMethods.map((pm) => (
            <li key={pm.id}>
              {pm.brand} ···· {pm.last4}
              {pm.isDefault ? (
                <span className="text-muted-dim"> (default)</span>
              ) : null}
            </li>
          ))}
        </ul>
      </RailCard>

      {profile.familyMembers.length > 0 ? (
        <RailCard title="Family">
          <ul className="space-y-2 text-base">
            {profile.familyMembers.map((member) => (
              <li key={member.id} className="text-foreground-soft">
                {member.name}
                <span className="text-muted"> · {member.relationship}</span>
                {member.spendingLimit != null ? (
                  <span className="text-muted-dim">
                    {" "}
                    · limit ${member.spendingLimit}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </RailCard>
      ) : null}

      <RailCard title="Relevant history">
        <ul className="space-y-1">
          {history.slice(0, 6).map((item) => (
            <li key={item.taskId}>
              <Link
                href={ROUTES.task(item.taskId)}
                className="block rounded-lg px-2 py-2 text-base transition-colors hover:bg-surface-hover"
              >
                <span className="font-medium text-foreground-soft">
                  #{item.taskNumber} {item.title}
                </span>
                <span className="mt-0.5 block text-sm capitalize text-muted-dim">
                  {item.status.replaceAll("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </RailCard>
    </aside>
  );
}
