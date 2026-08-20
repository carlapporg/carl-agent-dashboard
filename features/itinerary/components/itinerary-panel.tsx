"use client";

import {
  confirmItineraryAction,
  generateItineraryAction,
  sendItineraryAction,
} from "@/features/tasks/actions/task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Itinerary } from "@/types/itinerary";
import type { Task } from "@/types/task";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (childTasks.length === 0) return null;

  const allComplete = childTasks.every((c) => c.status === "completed");
  const confirmed = Boolean(itinerary?.agentConfirmedAt);
  const sent = Boolean(itinerary?.sentAt);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Itinerary</h2>
          <p className="mt-1 text-sm text-muted">
            Parent-only: generate, confirm, then send to the client.
          </p>
        </div>
        {!itinerary ? (
          <Button
            type="button"
            disabled={!allComplete || pending}
            loading={pending}
            onClick={() => {
              startTransition(async () => {
                await generateItineraryAction(parent.id);
                router.refresh();
              });
            }}
          >
            Generate itinerary
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={confirmed || pending}
              loading={pending && !confirmed}
              onClick={() => {
                startTransition(async () => {
                  await confirmItineraryAction(parent.id);
                  router.refresh();
                });
              }}
            >
              {confirmed ? "Confirmed" : "Confirm"}
            </Button>
            <Button
              type="button"
              disabled={!confirmed || sent || pending}
              loading={pending && confirmed && !sent}
              onClick={() => {
                startTransition(async () => {
                  await sendItineraryAction(parent.id);
                  router.refresh();
                });
              }}
            >
              {sent ? "Sent" : "Send to client"}
            </Button>
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
          <p className="text-base font-medium text-foreground">
            {itinerary.title}
          </p>
          <ul className="space-y-2">
            {itinerary.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-[#f8fafc] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground-soft">{item.label}</p>
                  <Badge variant="success">{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
