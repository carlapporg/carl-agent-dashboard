import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = {
  title: "Overview",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        Overview
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
        Your queue will live here. For now this is a calm shell while tasks,
        inbox, and payments land.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {["Needs attention", "In progress", "Waiting on customer"].map(
          (label) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-surface p-6 md:p-7"
            >
              <p className="text-sm uppercase tracking-wide text-muted-dim">
                {label}
              </p>
              <p className="mt-4 text-3xl font-semibold text-foreground-soft md:text-4xl">
                —
              </p>
              <p className="mt-2 text-sm text-muted md:text-base">
                Awaiting data
              </p>
            </div>
          ),
        )}
      </div>

      <div className="mt-10">
        <EmptyState
          title="No active tasks yet"
          description="When customers ask Carl for help, their work will show up here for you to handle."
        />
      </div>
    </div>
  );
}
