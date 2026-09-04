import { taskFacts } from "@/lib/tasks/details";
import type { Task } from "@/types/task";

export function TaskFacts({ task }: { task: Task }) {
  const facts = taskFacts(task);
  const membership = task.membership;
  const hasMembership =
    Boolean(membership?.brand?.trim()) &&
    Boolean(membership?.membershipId?.trim());

  if (facts.length === 0 && !hasMembership) return null;

  const membershipLine = hasMembership
    ? `${membership!.brand.trim()} — ${membership!.membershipId.trim()}`
    : "";

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Trip details</h2>

      {hasMembership ? (
        <div className="mt-3 rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Membership
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {membershipLine}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Client agreed to use this saved loyalty membership for this booking.
          </p>
        </div>
      ) : null}

      {facts.length > 0 ? (
        <dl className="mt-3 divide-y divide-border">
          {facts
            .filter((fact) => fact.key !== "membership")
            .map((fact) => (
              <div
                key={fact.key}
                className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
              >
                <dt className="w-40 shrink-0 text-sm font-medium text-muted">
                  {fact.label}
                </dt>
                <dd className="text-sm text-foreground">{fact.value}</dd>
              </div>
            ))}
        </dl>
      ) : null}
    </section>
  );
}
