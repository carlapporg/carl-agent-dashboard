"use client";

import { ComingSoonButton } from "@/components/ui/coming-soon-button";
import { Badge } from "@/components/ui/badge";

export function AvailabilityStub() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted">Availability</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="success">Online</Badge>
          <span className="text-sm text-muted-dim">Display only</span>
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
