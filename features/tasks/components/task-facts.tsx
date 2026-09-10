import { taskFacts } from "@/lib/tasks/details";
import type { Task } from "@/types/task";

/** Read-only trip / task fields — Figma “Task Details Confirmation” card. */
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
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-5 shadow-(--shadow-card)">
      <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-foreground">
        Task Details Confirmation
      </h2>

      {hasMembership ? (
        <div className="mt-4 rounded-[10px] border border-accent/25 bg-accent/[0.06] px-3 py-2.5">
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
        <dl className="mt-5 divide-y divide-border">
          {facts
            .filter((fact) => fact.key !== "membership")
            .map((fact) => (
              <div
                key={fact.key}
                className="grid grid-cols-1 gap-1 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(120px,0.4fr)_1fr] sm:gap-4"
              >
                <dt className="text-[16px] font-medium tracking-[-0.04em] text-muted">
                  {fact.label}
                </dt>
                <dd className="text-[16px] font-normal tracking-[-0.04em] text-foreground">
                  {fact.value}
                </dd>
              </div>
            ))}
        </dl>
      ) : null}
    </section>
  );
}
