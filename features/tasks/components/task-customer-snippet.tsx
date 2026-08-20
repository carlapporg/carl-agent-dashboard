"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";

type TaskCustomerSnippetProps = {
  profile: CustomerProfile;
  history: CustomerHistoryItem[];
  readOnly?: boolean;
};

export function TaskCustomerSnippet({
  profile,
  history,
  readOnly = false,
}: TaskCustomerSnippetProps) {
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [saved, setSaved] = useState(false);
  const pastCount = history.filter((h) => h.status === "completed").length;

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Customer</h2>
      <p className="mt-1 text-sm font-medium text-foreground-soft">
        {profile.name.split(" ")[0]} · {pastCount} past tasks
      </p>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Payment methods
        </p>
        <ul className="mt-1.5 space-y-1 text-sm text-foreground-soft">
          {profile.paymentMethods.map((pm) => (
            <li key={pm.id}>
              {pm.brand} ···· {pm.last4}
              {pm.isDefault ? (
                <span className="ml-1.5 text-xs text-muted">(default)</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-dim">
          Full card numbers are never shown.
        </p>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Notes
        </p>
        {readOnly ? (
          <p className="mt-1.5 text-sm text-foreground-soft">
            {notes || "No notes"}
          </p>
        ) : (
          <>
            <Textarea
              className="mt-1.5 min-h-16"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              rows={3}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              onClick={() => {
                // Mock local save until PATCH /customers/:id/notes
                setSaved(true);
              }}
            >
              {saved ? "Saved" : "Save notes"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
