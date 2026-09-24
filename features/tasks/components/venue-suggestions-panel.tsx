"use client";

import { useMemo } from "react";
import { useOps } from "@/features/ops/ops-provider";
import { VenuePickedCard } from "@/features/tasks/components/venue-picked-card";
import type { Task } from "@/types/task";
import {
  isUserLockedVenue,
  readTaskVenueMeta,
  shouldShowVenuePickedSummary,
  shouldShowWaitingForClientVenue,
  type VenueSuggestion,
} from "@/types/venue";

type VenueSuggestionsPanelProps = {
  task: Task;
};

/**
 * Venue UI for agents: wait after Start, or show the place the client locked.
 * No Places picker — suggestions go to the user app; agent is read-only.
 */
export function VenueSuggestionsPanel({ task }: VenueSuggestionsPanelProps) {
  const ops = useOps();
  const live =
    ops?.liveVenue?.taskId === task.id ? ops.liveVenue : null;

  const venue = useMemo(() => readTaskVenueMeta(task), [task]);

  const pickedFromLive: VenueSuggestion | null =
    live?.status === "picked" ? live.suggestion : null;

  const showPicked =
    shouldShowVenuePickedSummary(task) || Boolean(pickedFromLive);
  const showWaiting =
    !showPicked &&
    (shouldShowWaitingForClientVenue(task) ||
      live?.status === "suggestions_sent");

  const suggestionsPreview =
    live?.status === "suggestions_sent"
      ? live.suggestions
      : venue.venueSuggestions;

  if (!showPicked && !showWaiting) return null;

  if (showPicked) {
    const name = pickedFromLive?.name ?? venue.pickedName;
    if (!name) return null;
    const cardVenue: VenueSuggestion = pickedFromLive ?? {
      id: venue.pickedSuggestionId ?? "picked",
      name,
      address: venue.pickedAddress,
      rating: venue.pickedRating,
      priceLevel: null,
      mapsUrl: venue.pickedMapsUrl,
      types: [],
      lat: venue.pickedLat,
      lng: venue.pickedLng,
    };
    const clientLocked =
      isUserLockedVenue(venue.venueChoice) || live?.status === "picked";
    return (
      <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-4 shadow-(--shadow-card)">
        <VenuePickedCard
          venue={cardVenue}
          title={clientLocked ? "Customer selected" : "Venue chosen"}
        />
        <p className="mt-3 text-xs text-muted">
          {clientLocked
            ? "Use this place for booking and confirmation."
            : "Venue is locked on this confirmation."}
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-4 shadow-(--shadow-card)">
      <h3 className="text-sm font-semibold text-foreground">Venue</h3>
      <p className="mt-2 text-sm text-muted">
        Waiting for customer to pick a place
      </p>
      {suggestionsPreview.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          {suggestionsPreview.length} option
          {suggestionsPreview.length === 1 ? "" : "s"} sent to the customer
          (read-only).
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Place options were sent to the customer after you started the task.
        </p>
      )}
      {venue.venueSearchQuery ? (
        <p className="mt-1 text-xs text-muted">
          Search: “{venue.venueSearchQuery}”.
        </p>
      ) : null}
    </section>
  );
}
