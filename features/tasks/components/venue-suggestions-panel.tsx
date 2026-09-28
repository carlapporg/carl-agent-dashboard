"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useOps } from "@/features/ops/ops-provider";
import {
  searchVenueSuggestionsAction,
  sendVenueSuggestionsAction,
} from "@/features/tasks/actions/task-actions";
import { VenuePickedCard } from "@/features/tasks/components/venue-picked-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/toast-provider";
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
 * If the customer has not picked a place, the agent can search and send
 * the same place cards the user already gets in chat.
 */
export function VenueSuggestionsPanel({ task }: VenueSuggestionsPanelProps) {
  const ops = useOps();
  const { toast } = useToast();
  const live = ops?.liveVenue?.taskId === task.id ? ops.liveVenue : null;
  const venue = useMemo(() => readTaskVenueMeta(task), [task]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueSuggestion[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(
    () => readTaskVenueMeta(task).venueSuggestions.length,
  );

  const pickedFromLive: VenueSuggestion | null =
    live?.status === "picked" ? live.suggestion : null;

  const showPicked =
    shouldShowVenuePickedSummary(task) || Boolean(pickedFromLive);
  const showWaiting =
    !showPicked &&
    (shouldShowWaitingForClientVenue(task) ||
      live?.status === "suggestions_sent");

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

  function toggle(id: string) {
    setPickedIds((current) =>
      current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id],
    );
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2 || searching || sending) return;
    setSearching(true);
    void searchVenueSuggestionsAction(task.id, text).then((result) => {
      setSearching(false);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      setResults(result.suggestions);
      setPickedIds(result.suggestions.map((row) => row.id));
      if (result.suggestions.length === 0) {
        toast("No places found. Try a different search.", "error");
      }
    });
  }

  function onSend() {
    if (pickedIds.length === 0 || sending || searching) return;
    setSending(true);
    void sendVenueSuggestionsAction(task.id, pickedIds).then((result) => {
      setSending(false);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      const sent = result.suggestions.length
        ? result.suggestions
        : results.filter((row) => pickedIds.includes(row.id));
      setSentCount(sent.length);
      ops?.patchLiveTask(
        task.id,
        {
          metadata: {
            ...(task.metadata ?? {}),
            venueChoice: "AGENT_SUGGEST",
            venueSuggestions: sent,
            venueSearchQuery: query.trim(),
          },
        },
        task,
      );
      toast("Sent to the customer.", "success");
    });
  }

  return (
    <section className="overflow-hidden rounded-[15px] border border-border bg-surface p-4 shadow-(--shadow-card)">
      <h3 className="text-sm font-semibold text-foreground">Suggest a place</h3>
      <p className="mt-1 text-sm text-muted">
        The customer has not picked a place. Search, then send the cards to
        their chat.
      </p>
      {sentCount > 0 ? (
        <p className="mt-2 text-xs text-muted">
          {sentCount} option{sentCount === 1 ? "" : "s"} already with the
          customer. A new send replaces that list.
        </p>
      ) : null}

      <form className="mt-3 flex gap-2" onSubmit={onSearch}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place or area"
          aria-label="Search a place"
          disabled={searching || sending}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={searching}
          disabled={searching || sending || query.trim().length < 2}
        >
          Search
        </Button>
      </form>

      {results.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {results.map((row) => {
            const checked = pickedIds.includes(row.id);
            return (
              <li key={row.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-[12px] border border-border px-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(row.id)}
                    disabled={sending}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {row.name}
                    </span>
                    {row.address ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {row.address}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      {results.length > 0 ? (
        <Button
          type="button"
          className="mt-3"
          loading={sending}
          disabled={sending || searching || pickedIds.length === 0}
          onClick={onSend}
        >
          Send to customer
        </Button>
      ) : null}
    </section>
  );
}
