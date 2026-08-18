"use client";

import { ComingSoonButton } from "@/components/ui/coming-soon-button";
import { Badge } from "@/components/ui/badge";

export function AvailabilityStub() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-base font-semibold text-foreground">Availability</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Badge variant="success">Online</Badge>
          <span className="text-base text-muted">
            Display only — controls are coming soon.
          </span>
        </div>
      </div>
      <ComingSoonButton
        variant="secondary"
        message="Availability controls are coming soon"
        title="Coming soon"
      >
        Change status
      </ComingSoonButton>
    </div>
  );
}
