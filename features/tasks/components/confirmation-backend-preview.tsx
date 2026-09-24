"use client";

import { cn } from "@/lib/utils/cn";
import type { TaskConfirmation } from "@/types/confirmation";

type ConfirmationBackendPreviewProps = {
  confirmation: TaskConfirmation;
  className?: string;
};

/** Nest-internal venue pipeline keys — not useful on the agent confirmation card. */
function isInternalVenueRow(label: string, value: string): boolean {
  const text = `${label} ${value}`.toLowerCase();
  if (/venue\s*choice/.test(text)) return true;
  if (/picked\s*suggestion/.test(text)) return true;
  if (/venue\s*search/.test(text)) return true;
  if (/venue\s*suggestions/.test(text)) return true;
  if (/venue\s*(lat|lng|place)/.test(text)) return true;
  if (
    /^(user_picked|user_custom|agent_suggest|agent_picked)$/i.test(value.trim())
  ) {
    return true;
  }
  return false;
}

/**
 * Renders Nest confirmation preview (title, summary, rows, costDisplay).
 * Hides internal venue pipeline rows like Venue Choice = USER_CUSTOM.
 */
export function ConfirmationBackendPreview({
  confirmation,
  className,
}: ConfirmationBackendPreviewProps) {
  const rows = (confirmation.rows ?? []).filter(
    (row) => !isInternalVenueRow(row.label, row.value),
  );
  const costDisplay =
    confirmation.costDisplay ||
    `${confirmation.currency} ${confirmation.cost}`.trim();

  return (
    <div className={cn("space-y-2", className)}>
      {confirmation.title ? (
        <p className="text-sm font-semibold text-foreground">
          {confirmation.title}
        </p>
      ) : null}
      {confirmation.summary ? (
        <p className="text-sm text-foreground-soft">{confirmation.summary}</p>
      ) : null}

      {rows.length > 0 ? (
        <dl className="divide-y divide-black/5">
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4"
            >
              <dt className="w-36 shrink-0 text-sm font-medium text-muted">
                {row.label}
              </dt>
              <dd className="text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : confirmation.notes ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {confirmation.notes}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {confirmation.costLabel || "Total"}
        </p>
        <p className="text-xl font-semibold tracking-tight text-foreground">
          {costDisplay}
        </p>
      </div>
    </div>
  );
}
