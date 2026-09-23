"use client";

import { useEffect, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  createPayoutConnectLinkAction,
  createPayoutLoginLinkAction,
  disconnectStripeAction,
  getPayoutSettingsAction,
} from "@/features/payout-settings/actions";
import { queryKeys } from "@/lib/query/keys";
import type { PayoutOnboardingStatus } from "@/types/payout-settings";

/** Survives React Strict Mode remount so the Stripe return toast fires once. */
let stripeReturnToastHandled = false;

function statusBadgeVariant(
  status: PayoutOnboardingStatus,
): "muted" | "warning" | "accent" | "danger" {
  switch (status) {
    case "complete":
      return "accent";
    case "pending":
      return "warning";
    case "restricted":
      return "danger";
    default:
      return "muted";
  }
}

function statusLabel(status: PayoutOnboardingStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "pending":
      return "Pending";
    case "complete":
      return "Connected";
    case "restricted":
      return "Restricted";
    default:
      return status;
  }
}

function maskLast4(last4: string | null | undefined): string {
  if (!last4) return "—";
  return `••••${last4}`;
}

/** Stripe return/refresh URLs land back on this page — stay in the same tab. */
function openStripeInSameTab(url: string): void {
  window.location.assign(url);
}

export function PayoutSettingsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [linkBusy, setLinkBusy] = useState<"connect" | "login" | null>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.payoutSettings.all,
    queryFn: async () => {
      const result = await getPayoutSettingsAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const settings = settingsQuery.data;

  useEffect(() => {
    const stripe = searchParams.get("stripe");
    if (!stripe || stripeReturnToastHandled) return;
    stripeReturnToastHandled = true;

    void settingsQuery.refetch();
    if (stripe === "return") {
      toast("Returned from Stripe. Status refreshed.", "success");
    } else if (stripe === "refresh") {
      toast("Stripe link expired. Start Connect again if needed.", "info");
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("stripe");
    window.history.replaceState({}, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for return/refresh
  }, []);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.payoutSettings.all,
    });
  }

  function handleConnect() {
    stripeReturnToastHandled = false;
    setLinkBusy("connect");
    startTransition(async () => {
      const result = await createPayoutConnectLinkAction("US");
      setLinkBusy(null);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      invalidate();
      toast("Opening Stripe Connect…", "success");
      openStripeInSameTab(result.data.url);
    });
  }

  function handleLoginLink() {
    stripeReturnToastHandled = false;
    setLinkBusy("login");
    startTransition(async () => {
      const result = await createPayoutLoginLinkAction();
      setLinkBusy(null);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast("Opening Stripe dashboard…", "success");
      openStripeInSameTab(result.data.url);
    });
  }

  function handleDisconnectStripe() {
    startTransition(async () => {
      const result = await disconnectStripeAction();
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      queryClient.setQueryData(queryKeys.payoutSettings.all, result.data);
      setConfirmDisconnect(false);
      toast("Stripe Connect disconnected.", "success");
    });
  }

  if (settingsQuery.isPending && !settings) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8 text-sm text-muted shadow-[var(--shadow-card)]">
        Loading payout settings…
      </div>
    );
  }

  if (settingsQuery.isError && !settings) {
    return (
      <EmptyState
        title="Can't load payout settings"
        description={
          settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : "Refresh and try again."
        }
        action={
          <Button type="button" onClick={() => void settingsQuery.refetch()}>
            Refresh
          </Button>
        }
      />
    );
  }

  if (!settings) return null;

  const canManageStripe =
    settings.onboardingStatus === "complete" || settings.detailsSubmitted;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Payout Settings
          </h1>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void settingsQuery.refetch()}
          disabled={settingsQuery.isFetching}
        >
          {settingsQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Stripe Connect
            </h2>
            <Badge variant={statusBadgeVariant(settings.onboardingStatus)}>
              {statusLabel(settings.onboardingStatus)}
            </Badge>
          </div>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {!settings.stripeConfigured ? (
            <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
              Stripe is not configured on the server. Connect is unavailable.
              Ask ops to set Stripe keys.
            </p>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Connect account
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {settings.hasConnectAccount ? "Created" : "None yet"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Payouts enabled
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {settings.payoutsEnabled ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Details submitted
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {settings.detailsSubmitted ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Stripe bank
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {settings.bankName || "—"}{" "}
                {settings.bankLast4 ? (
                  <span className="text-muted">
                    {maskLast4(settings.bankLast4)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {settings.onboardingStatus === "complete" ? (
              <span className="inline-flex h-[length:var(--control-height)] items-center rounded-[var(--radius-md)] border border-accent/25 bg-accent/10 px-4 text-sm font-semibold text-accent">
                Connected
              </span>
            ) : (
              <Button
                type="button"
                onClick={handleConnect}
                loading={linkBusy === "connect"}
                disabled={
                  pending || !settings.stripeConfigured || linkBusy !== null
                }
              >
                {settings.hasConnectAccount
                  ? "Continue Stripe setup"
                  : "Connect with Stripe"}
              </Button>
            )}
            {canManageStripe ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleLoginLink}
                loading={linkBusy === "login"}
                disabled={
                  pending || !settings.stripeConfigured || linkBusy !== null
                }
              >
                Manage in Stripe
              </Button>
            ) : null}
            {settings.onboardingStatus === "complete" &&
            settings.hasConnectAccount ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleConnect}
                loading={linkBusy === "connect"}
                disabled={
                  pending || !settings.stripeConfigured || linkBusy !== null
                }
              >
                Re-open Stripe setup
              </Button>
            ) : null}
            {settings.hasConnectAccount ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmDisconnect(true)}
                disabled={pending || linkBusy !== null}
              >
                Disconnect Stripe
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnectStripe}
        title="Disconnect Stripe?"
        description="This deletes your Stripe Express account from Carl and resets Connect status. You can connect again later."
        confirmLabel="Disconnect Stripe"
        cancelLabel="Keep connected"
        loading={pending}
        destructive
      />
    </div>
  );
}
