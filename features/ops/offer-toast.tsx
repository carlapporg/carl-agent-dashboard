"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OfferCountdown } from "@/features/ops/offer-countdown";
import { useOps } from "@/features/ops/ops-provider";
import { ROUTES } from "@/lib/constants/routes";
import { offerWindowEnd } from "@/types/agent";

export function OfferToast() {
  const ops = useOps();
  const [leaving, setLeaving] = useState(false);
  const offer = ops?.offer ?? null;

  useEffect(() => {
    if (!offer) return;
    setLeaving(false);
    const id = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => ops?.dismissOffer(), 220);
    }, 7000);
    return () => window.clearTimeout(id);
  }, [offer, ops]);

  if (!offer || !ops) return null;

  return (
    <div
      className={`pointer-events-none fixed top-4 right-4 z-[120] w-[min(100%-2rem,17rem)] ${
        leaving ? "ops-toast-out" : "ops-toast-in"
      }`}
    >
      <div className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card)">
        <div className="flex items-start gap-2 px-2.5 py-2">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              {offer.backendStatus === "ASSIGNED"
                ? "Assigned"
                : "New offer"}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">
              {offer.title}
            </p>
            <p className="truncate text-[11px] text-muted">
              {offer.customerName}
            </p>
            {offer.backendStatus === "OFFERED" ? (
              <div className="mt-1.5">
                <OfferCountdown
                  expiresAt={offerWindowEnd(offer)}
                  taskId={offer.id}
                  autoAccept
                  onExpire={() => ops.refresh()}
                />
              </div>
            ) : null}
            <Link
              href={ROUTES.task(offer.id)}
              onClick={() => ops.dismissOffer()}
              className="mt-1.5 inline-flex text-[12px] font-semibold text-accent hover:text-accent-hover"
            >
              Open
            </Link>
          </div>
          <button
            type="button"
            onClick={() => ops.dismissOffer()}
            className="shrink-0 rounded px-1 text-sm leading-none text-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
