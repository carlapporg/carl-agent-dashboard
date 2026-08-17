import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";

type CustomerRailProps = {
  profile: CustomerProfile;
  history: CustomerHistoryItem[];
};

export function CustomerRail({ profile, history }: CustomerRailProps) {
  return (
    <aside className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Customer
        </h2>
        <p className="mt-3 text-lg font-medium text-foreground">{profile.name}</p>
        <p className="text-sm text-muted">{profile.email}</p>
        {profile.phone ? (
          <p className="text-sm text-muted">{profile.phone}</p>
        ) : null}
        {profile.notes ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground-soft">
            {profile.notes}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted-dim">
          Member since {new Date(profile.memberSince).toLocaleDateString()}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Preferences
        </h2>
        <ul className="mt-3 space-y-2">
          {profile.preferences.map((pref) => (
            <li key={pref.key} className="text-sm">
              <span className="text-muted">{pref.key}: </span>
              <span className="text-foreground-soft">{pref.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Spending rules
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Auto-approve under</dt>
            <dd className="text-foreground-soft">
              ${profile.spendingRules.autoApproveUnder}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Monthly limit</dt>
            <dd className="text-foreground-soft">
              ${profile.spendingRules.monthlyLimit.toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Payment methods
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground-soft">
          {profile.paymentMethods.map((pm) => (
            <li key={pm.id}>
              {pm.brand} ···· {pm.last4}
              {pm.isDefault ? (
                <span className="text-muted-dim"> (default)</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {profile.familyMembers.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
            Family
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
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
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Relevant history
        </h2>
        <ul className="mt-3 space-y-2">
          {history.slice(0, 6).map((item) => (
            <li key={item.taskId}>
              <Link
                href={ROUTES.task(item.taskId)}
                className="block rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-hover"
              >
                <span className="text-foreground-soft">
                  #{item.taskNumber} {item.title}
                </span>
                <span className="mt-0.5 block text-xs capitalize text-muted-dim">
                  {item.status.replaceAll("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
