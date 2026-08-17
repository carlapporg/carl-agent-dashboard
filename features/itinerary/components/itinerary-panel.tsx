"use client";

import { ComingSoonButton } from "@/components/ui/coming-soon-button";
import { generateItineraryAction } from "@/features/tasks/actions/task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Itinerary } from "@/types/itinerary";
import type { Task } from "@/types/task";

type ItineraryPanelProps = {
  parent: Task;
  childTasks: Task[];
  itinerary: Itinerary | null;
};

export function ItineraryPanel({
  parent,
  childTasks,
  itinerary,
}: ItineraryPanelProps) {
  if (childTasks.length === 0) return null;

  const allComplete = childTasks.every((c) => c.status === "completed");

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
            Itinerary
          </h2>
          <p className="mt-2 text-base text-foreground-soft">
            Consolidated view when every subtask is done.
          </p>
        </div>
        {!itinerary ? (
          <form action={generateItineraryAction.bind(null, parent.id)}>
            <Button type="submit" disabled={!allComplete}>
              Generate itinerary
            </Button>
          </form>
        ) : (
          <div className="flex gap-2">
            <ComingSoonButton
              variant="secondary"
              message="Print is coming soon"
            >
              Print
            </ComingSoonButton>
            <ComingSoonButton
              variant="secondary"
              message="Share is coming soon"
            >
              Share
            </ComingSoonButton>
          </div>
        )}
      </div>

      {!allComplete && !itinerary ? (
        <p className="mt-4 text-sm text-muted">
          Finish remaining subtasks before generating.
        </p>
      ) : null}

      {itinerary ? (
        <div className="mt-5 space-y-3">
          <p className="text-lg font-medium text-foreground">{itinerary.title}</p>
          <ul className="space-y-2">
            {itinerary.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-surface-elevated px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground-soft">{item.label}</p>
                  <Badge variant="success">{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-dim">
            Generated {new Date(itinerary.generatedAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </section>
  );
}
