"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import { useOps } from "@/features/ops/ops-provider";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function OfferToast() {
  const ops = useOps();
  const [leaving, setLeaving] = useState(false);
  const offer = ops?.offer ?? null;

  useEffect(() => {
    if (!offer) return;
    setLeaving(false);
    const id = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => ops?.dismissOffer(), 280);
    }, 8000);
    return () => window.clearTimeout(id);
  }, [offer, ops]);

  if (!offer || !ops) return null;

  const received = new Date(offer.updatedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={`pointer-events-none fixed top-4 right-4 z-[120] w-[min(100%-2rem,22rem)] ${
        leaving ? "ops-toast-out" : "ops-toast-in"
      }`}
    >
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-accent/25 bg-surface shadow-[var(--shadow-soft)] ring-1 ring-accent/10">
        <div className="h-1 bg-accent ops-toast-bar" />
        <div className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            New task assigned
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {offer.title}
          </p>
          <p className="mt-1 text-sm text-muted">
            {offer.taskType?.replaceAll("_", " ") ?? "Task"} ·{" "}
            {offer.customerName} · {received}
          </p>
          {offer.expiresAt ? (
            <div className="mt-3">
              <OfferCountdown expiresAt={offer.expiresAt} size="lg" />
            </div>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Link href={ROUTES.task(offer.id)} onClick={() => ops.dismissOffer()}>
              <Button type="button">Open task</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
