"use client";

import { useMemo } from "react";
import type { Task } from "@/types/task";
import {
  isUserLockedVenue,
  readTaskVenueMeta,
  shouldShowVenuePickedSummary,
  shouldShowWaitingForClientVenue,
} from "@/types/venue";

type VenueSuggestionsPanelProps = {
  task: Task;
};

function StarRating({ value }: { value: number }) {
  return (
    <span className="tabular-nums text-accent">
      {value.toFixed(1)}
      <span className="text-muted"> ★</span>
    </span>
  );
}

function LockedVenueCard({
  title,
  name,
  address,
  rating,
  mapsUrl,
  footnote,
}: {
  title: string;
  name: string;
  address: string | null;
  rating: number | null;
  mapsUrl: string | null;
  footnote: string;
}) {
  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-4 shadow-(--shadow-card)">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm font-medium text-foreground">{name}</p>
      {address ? <p className="mt-1 text-xs text-muted">{address}</p> : null}
      {rating != null ? (
        <p className="mt-1 text-xs text-muted">
          <StarRating value={rating} />
        </p>
      ) : null}
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-accent hover:underline"
        >
          Open in Maps
        </a>
      ) : null}
      <p className="mt-3 text-xs text-muted">{footnote}</p>
    </section>
  );
}

/**
 * Venue UI for agents: show the one place the client locked, or wait.
 * No Places list / refresh — that lives on mobile.
 */
export function VenueSuggestionsPanel({ task }: VenueSuggestionsPanelProps) {
  const showPicked = shouldShowVenuePickedSummary(task);
  const showWaiting = shouldShowWaitingForClientVenue(task);
  const venue = useMemo(() => readTaskVenueMeta(task), [task]);

  if (!showPicked && !showWaiting) return null;

  if (showPicked && venue.pickedName) {
    const clientLocked = isUserLockedVenue(venue.venueChoice);
    return (
      <LockedVenueCard
        title={clientLocked ? "Client selected venue" : "Venue chosen"}
        name={
          clientLocked
            ? `Client picked: ${venue.pickedName}`
            : venue.pickedName
        }
        address={venue.pickedAddress}
        rating={venue.pickedRating}
        mapsUrl={venue.pickedMapsUrl}
        footnote={
          clientLocked
            ? "This place is locked by the client. Confirmation will use it."
            : "Venue is locked on this confirmation. Client decline is needed before another pick."
        }
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-4 shadow-(--shadow-card)">
      <h3 className="text-sm font-semibold text-foreground">Venue</h3>
      <p className="mt-2 text-sm text-muted">
        Waiting for the client to send one place. You do not pick from
        suggestions — use confirmation once their venue appears here.
      </p>
      {venue.venueSearchQuery ? (
        <p className="mt-2 text-xs text-muted">
          Client search: “{venue.venueSearchQuery}”.
        </p>
      ) : null}
    </section>
  );
}
