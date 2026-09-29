"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearManualBankAction,
  createPayoutConnectLinkAction,
  createPayoutLoginLinkAction,
  disconnectStripeAction,
  getPayoutSettingsAction,
  saveManualBankAction,
} from "@/features/payout-settings/actions";
import { PayRequestPanel } from "@/features/earnings/components/pay-request-panel";
import { queryKeys } from "@/lib/query/keys";
import type {
  PayoutAccountType,
  PayoutOnboardingStatus,
  PayoutSettings,
} from "@/types/payout-settings";

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

type BankFormState = {
  holderName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: PayoutAccountType;
  bankName: string;
};

function emptyBankForm(): BankFormState {
  return {
    holderName: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
    bankName: "",
  };
}

function formFromSettings(settings: PayoutSettings): BankFormState {
  return {
    holderName: settings.manualBankHolderName ?? "",
    routingNumber: "",
    accountNumber: "",
    accountType: settings.manualBankAccountType ?? "checking",
    bankName: settings.manualBankName ?? "",
  };
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
  const [editingBank, setEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState<BankFormState>(emptyBankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
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

  function beginEditBank() {
    if (!settings) return;
    setBankForm(formFromSettings(settings));
    setFormError(null);
    setEditingBank(true);
  }

  function beginAddBank() {
    setBankForm(emptyBankForm());
    setFormError(null);
    setEditingBank(true);
  }

  function cancelEditBank() {
    setEditingBank(false);
    setFormError(null);
    setBankForm(emptyBankForm());
  }

  function handleSaveBank(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload = {
      holderName: bankForm.holderName.trim(),
      routingNumber: bankForm.routingNumber.replace(/\s+/g, ""),
      accountNumber: bankForm.accountNumber.replace(/\s+/g, ""),
      accountType: bankForm.accountType,
      bankName: bankForm.bankName.trim() || undefined,
      preferredPayoutMethod: "manual_bank" as const,
    };
    startTransition(async () => {
      const result = await saveManualBankAction(payload);
      setBankForm((prev) => ({ ...prev, accountNumber: "", routingNumber: "" }));
      if (!result.ok) {
        setFormError(result.message);
        toast(result.message, "error");
        return;
      }
      queryClient.setQueryData(queryKeys.payoutSettings.all, result.data);
      setEditingBank(false);
      setBankForm(emptyBankForm());
      toast("Bank details saved. Only the last 4 digits stay on screen.", "success");
    });
  }

  function handleClearBank() {
    startTransition(async () => {
      const result = await clearManualBankAction();
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      queryClient.setQueryData(queryKeys.payoutSettings.all, result.data);
      setConfirmClear(false);
      setEditingBank(false);
      setBankForm(emptyBankForm());
      toast("Manual bank details removed.", "success");
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
      toast("Stripe Connect disconnected. Manual bank was kept.", "success");
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

      <PayRequestPanel />

      <section className="flex min-h-[320px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Stripe Connect
            </h2>
            <Badge variant={statusBadgeVariant(settings.onboardingStatus)}>
              {statusLabel(settings.onboardingStatus)}
            </Badge>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-8 px-5 py-8 sm:px-6 sm:py-10">
          {!settings.stripeConfigured ? (
            <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
              Stripe is not configured on the server. Connect is unavailable.
              Ask ops to set Stripe keys.
            </p>
          ) : null}

          <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Connect account
              </dt>
              <dd className="mt-1.5 text-sm text-foreground">
                {settings.hasConnectAccount ? "Created" : "None yet"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Payouts enabled
              </dt>
              <dd className="mt-1.5 text-sm text-foreground">
                {settings.payoutsEnabled ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Details submitted
              </dt>
              <dd className="mt-1.5 text-sm text-foreground">
                {settings.detailsSubmitted ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Stripe bank
              </dt>
              <dd className="mt-1.5 text-sm text-foreground">
                {settings.bankName || "—"}{" "}
                {settings.bankLast4 ? (
                  <span className="text-muted">
                    {maskLast4(settings.bankLast4)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
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

      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">
            Manual bank (ACH)
          </h2>
          <p className="mt-1 text-sm text-muted">
            US only. Routing must be 9 digits. Account number is 4–17 digits.
            After save, only the last 4 digits are shown.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {settings.hasManualBank && !editingBank ? (
            <>
              <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Holder
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground">
                    {settings.manualBankHolderName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Bank
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground">
                    {settings.manualBankName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Account
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground">
                    {maskLast4(settings.manualBankLast4)}
                    {settings.manualBankAccountType
                      ? ` · ${settings.manualBankAccountType}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Routing
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground">
                    {maskLast4(settings.manualBankRoutingLast4)}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={beginEditBank}>
                  Edit bank
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirmClear(true)}
                  disabled={pending}
                >
                  Remove bank
                </Button>
              </div>
            </>
          ) : null}

          {!settings.hasManualBank && !editingBank ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                No manual bank saved. Add US bank details if you are not using
                Stripe.
              </p>
              <Button type="button" onClick={beginAddBank}>
                Add bank
              </Button>
            </div>
          ) : null}

          {editingBank ? (
            <form onSubmit={handleSaveBank} className="space-y-4" autoComplete="off">
              {formError ? (
                <p className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {formError}
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="holderName">Account holder name</Label>
                  <Input
                    id="holderName"
                    name="holderName"
                    value={bankForm.holderName}
                    onChange={(e) =>
                      setBankForm((p) => ({ ...p, holderName: e.target.value }))
                    }
                    autoComplete="off"
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={pending}
                  />
                </div>
                <div>
                  <Label htmlFor="routingNumber">Routing number</Label>
                  <Input
                    id="routingNumber"
                    name="routingNumber"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="9 digits"
                    value={bankForm.routingNumber}
                    onChange={(e) =>
                      setBankForm((p) => ({
                        ...p,
                        routingNumber: e.target.value.replace(/\D/g, "").slice(0, 9),
                      }))
                    }
                    autoComplete="off"
                    required
                    disabled={pending}
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Account number</Label>
                  <Input
                    id="accountNumber"
                    name="accountNumber"
                    inputMode="numeric"
                    maxLength={17}
                    placeholder={
                      settings.hasManualBank
                        ? "Re-enter full account number"
                        : "4–17 digits"
                    }
                    value={bankForm.accountNumber}
                    onChange={(e) =>
                      setBankForm((p) => ({
                        ...p,
                        accountNumber: e.target.value.replace(/\D/g, "").slice(0, 17),
                      }))
                    }
                    autoComplete="off"
                    required
                    disabled={pending}
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Account type</Label>
                  <select
                    id="accountType"
                    name="accountType"
                    value={bankForm.accountType}
                    onChange={(e) =>
                      setBankForm((p) => ({
                        ...p,
                        accountType: e.target.value as PayoutAccountType,
                      }))
                    }
                    disabled={pending}
                    className="h-[length:var(--control-height)] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3.5 text-sm text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="bankName">Bank name (optional)</Label>
                  <Input
                    id="bankName"
                    name="bankName"
                    maxLength={80}
                    value={bankForm.bankName}
                    onChange={(e) =>
                      setBankForm((p) => ({ ...p, bankName: e.target.value }))
                    }
                    autoComplete="off"
                    disabled={pending}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={pending}>
                  Save bank
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancelEditBank}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClearBank}
        title="Remove manual bank?"
        description="This deletes your saved bank details. You can add a bank again later."
        confirmLabel="Remove bank"
        cancelLabel="Keep bank"
        loading={pending}
        destructive
      />
      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnectStripe}
        title="Disconnect Stripe?"
        description="This deletes your Stripe Express account from Carl and resets Connect status. Manual bank details are kept. You can connect again later."
        confirmLabel="Disconnect Stripe"
        cancelLabel="Keep connected"
        loading={pending}
        destructive
      />
    </div>
  );
}
