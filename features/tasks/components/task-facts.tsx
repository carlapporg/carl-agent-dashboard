import { taskFacts } from "@/lib/tasks/details";
import type { Task } from "@/types/task";

export function TaskFacts({ task }: { task: Task }) {
  const facts = taskFacts(task);
  if (facts.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Trip details</h2>
      <dl className="mt-3 divide-y divide-border">
        {facts.map((fact) => (
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
    </section>
  );
}
