"use client";

import { cn } from "@/lib/utils/cn";
import { mapsUrlForVenue, type VenueSuggestion } from "@/types/venue";

type VenuePickedCardProps = {
  venue: VenueSuggestion;
  title?: string;
  className?: string;
  compact?: boolean;
};

function StarRating({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      {value.toFixed(1)}
      <span className="opacity-70"> ★</span>
    </span>
  );
}

/** Rich “Customer selected” venue card for chat / task panel. */
export function VenuePickedCard({
  venue,
  title = "Customer selected",
  className,
  compact = false,
}: VenuePickedCardProps) {
  const mapHref = mapsUrlForVenue(venue);

  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-surface-muted text-foreground",
        compact ? "px-3 py-2.5" : "px-3.5 py-3",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        {title}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold text-foreground",
          compact ? "text-[13px]" : "text-sm",
        )}
      >
        {venue.name}
      </p>
      {venue.address ? (
        <p className="mt-1 text-xs leading-snug text-muted">{venue.address}</p>
      ) : null}
      {venue.rating != null ? (
        <p className="mt-1 text-xs text-muted">
          <StarRating value={venue.rating} />
        </p>
      ) : null}
      {mapHref ? (
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-xs font-semibold text-accent hover:underline"
        >
          Open map
        </a>
      ) : null}
    </div>
  );
}
