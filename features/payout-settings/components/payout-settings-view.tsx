"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/components/providers/toast-provider";
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
import { queryKeys } from "@/lib/query/keys";
import type {
  PayoutAccountType,
  PayoutOnboardingStatus,
  PayoutSettings,
} from "@/types/payout-settings";

/** Survives React Strict Mode remount so the Stripe return toast fires once. */
let stripeReturnToastHandled = false;

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

  const connected = settings.onboardingStatus === "complete";
  const canManageStripe = connected || settings.detailsSubmitted;
  const currency = (settings.currency ?? "USD").toUpperCase();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[32px] font-medium leading-[1.3] tracking-[-0.05em] text-black">
          Payout Settings
        </h1>
        <p className="mt-1 max-w-[588px] text-[16px] font-normal leading-[1.3] tracking-[-0.02em] text-black/50">
          Manage your payout methods, payment details, and preferences to
          receive your earnings securely and on time.
        </p>
      </header>

      {!settings.stripeConfigured ? (
        <p className="rounded-[12px] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
          Stripe is not configured on the server. Connect is unavailable. Ask
          ops to set Stripe keys.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-[16px] border border-[rgba(226,232,240,0.9)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f1f5f9] px-7 py-7">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(99,91,255,0.2)] bg-[rgba(99,91,255,0.1)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma/payout/stripe.svg" alt="" width={28} height={28} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[18px] font-bold leading-7 tracking-[-0.025em] text-[#0f172a]">
                  Stripe Connect
                </h2>
                <span
                  className={
                    connected
                      ? "inline-flex items-center gap-1.5 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-[11px] py-[3px] text-[12px] font-semibold leading-4 text-[#047857]"
                      : "inline-flex items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-[11px] py-[3px] text-[12px] font-semibold leading-4 text-[#475569]"
                  }
                >
                  {connected ? (
                    <span className="size-1.5 rounded-full bg-[#10b981]" />
                  ) : null}
                  {connected ? "Connected & Verified" : statusLabel(settings.onboardingStatus)}
                </span>
                {settings.hasConnectAccount ? (
                  <span className="rounded-[4px] bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-medium leading-[16.5px] text-[#475569]">
                    Standard Express
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[14px] leading-5 text-[#64748b]">
                Automatic payouts, multi-currency conversion, and express
                merchant onboarding handled via Stripe.
              </p>
            </div>
          </div>
          <span
            className={
              settings.payoutsEnabled
                ? "inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(226,232,240,0.8)] bg-[#f8fafc] px-[13px] py-[7px] text-[12px] font-medium leading-4 text-[#64748b]"
                : "inline-flex items-center rounded-[8px] border border-[rgba(226,232,240,0.8)] bg-[#f8fafc] px-[13px] py-[7px] text-[12px] font-medium leading-4 text-[#94a3b8]"
            }
          >
            {settings.payoutsEnabled ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/figma/payout/payouts-check.svg" alt="" width={14} height={14} />
            ) : null}
            {settings.payoutsEnabled ? "Payouts Active" : "Payouts off"}
          </span>
        </div>

        <dl className="grid gap-6 bg-[rgba(248,250,252,0.5)] p-7 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
              Connect account
            </dt>
            <dd className="mt-1.5 flex items-center gap-2 text-[16px] font-semibold leading-6 text-[#0f172a]">
              {settings.hasConnectAccount ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-[#d1fae5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/figma/payout/check-circle.svg" alt="" width={12} height={12} />
                </span>
              ) : null}
              {settings.hasConnectAccount
                ? connected
                  ? "Created & Active"
                  : "Created"
                : "None yet"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
              Payouts enabled
            </dt>
            <dd className="mt-1.5 flex items-center gap-2 text-[16px] font-semibold leading-6 text-[#0f172a]">
              <span
                className={
                  settings.payoutsEnabled
                    ? "size-2.5 rounded-full bg-[#10b981]"
                    : "size-2.5 rounded-full bg-[#cbd5e1]"
                }
              />
              {settings.payoutsEnabled ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
              Details submitted
            </dt>
            <dd className="mt-1.5 flex items-center gap-1.5 text-[16px] font-semibold leading-6 text-[#0f172a]">
              {settings.detailsSubmitted ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/figma/payout/verified.svg" alt="" width={16} height={16} />
              ) : null}
              {settings.detailsSubmitted ? "Fully Verified" : "Not yet"}
            </dd>
            {settings.detailsSubmitted ? (
              <p className="mt-1.5 text-[12px] text-[#94a3b8]">
                Identity & business verified
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
              Stripe bank
            </dt>
            <dd className="mt-1.5 flex items-center gap-2 text-[16px] font-semibold leading-6 text-[#0f172a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma/payout/card.svg" alt="" width={16} height={16} />
              {settings.bankName || "—"}
            </dd>
            {settings.bankLast4 ? (
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-[#475569]">
                {maskLast4(settings.bankLast4)}
                <span className="rounded-[4px] bg-[rgba(226,232,240,0.6)] px-1.5 py-0.5 font-sans text-[11px] font-medium text-[#94a3b8]">
                  {currency}
                </span>
              </p>
            ) : null}
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(226,232,240,0.8)] bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {canManageStripe ? (
              <button
                type="button"
                onClick={handleLoginLink}
                disabled={pending || !settings.stripeConfigured || linkBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[rgba(99,91,255,0.1)] px-4 py-2 text-[14px] font-semibold leading-5 text-[#635bff] disabled:opacity-50"
              >
                Manage in Stripe
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/figma/payout/external.svg" alt="" width={16} height={16} />
              </button>
            ) : null}
            {connected && settings.hasConnectAccount ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={pending || !settings.stripeConfigured || linkBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-[15px] py-[9px] text-[14px] font-medium leading-5 text-[#334155] disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/figma/payout/reopen.svg" alt="" width={16} height={16} />
                {linkBusy === "connect" ? "Opening…" : "Re-open Stripe setup"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={pending || !settings.stripeConfigured || linkBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[rgba(99,91,255,0.1)] px-4 py-2 text-[14px] font-semibold leading-5 text-[#635bff] disabled:opacity-50"
              >
                {linkBusy === "connect"
                  ? "Opening…"
                  : settings.hasConnectAccount
                    ? "Continue Stripe setup"
                    : "Connect with Stripe"}
              </button>
            )}
          </div>
          {settings.hasConnectAccount ? (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              disabled={pending || linkBusy !== null}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(254,205,211,0.8)] bg-[rgba(255,241,242,0.7)] px-[15px] py-[9px] text-[14px] font-medium leading-5 text-[#e11d48] disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma/payout/disconnect.svg" alt="" width={16} height={16} />
              Disconnect Stripe
            </button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[16px] border border-[rgba(226,232,240,0.9)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f1f5f9] px-7 py-7">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-[#e2e8f0] bg-[#f1f5f9] shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma/payout/bank.svg" alt="" width={24} height={24} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[18px] font-bold leading-7 tracking-[-0.025em] text-[#0f172a]">
                  Manual bank (ACH Direct Deposit)
                </h2>
                {settings.preferredPayoutMethod === "manual_bank" ? (
                  <span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-[9px] py-[3px] text-[12px] font-medium leading-4 text-[#1d4ed8]">
                    Default Backup
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[14px] leading-5 text-[#64748b]">
                US only. Standard Automated Clearing House (ACH) direct
                transfers for fallback withdrawals.
              </p>
            </div>
          </div>
          {settings.hasManualBank ? (
            <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#a7f3d0] bg-[#ecfdf5] px-[13px] py-[5px] text-[12px] font-semibold leading-4 text-[#047857]">
              <span className="size-1.5 rounded-full bg-[#10b981]" />
              Ready
            </span>
          ) : null}
        </div>

        <div className="px-7 pt-5">
          <div className="flex gap-3 rounded-[12px] border border-[rgba(253,230,138,0.8)] bg-[rgba(255,251,235,0.6)] px-[17px] py-[13px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/figma/payout/lock.svg" alt="" width={20} height={20} className="mt-0.5 shrink-0" />
            <p className="text-[12px] font-semibold leading-[19.5px] text-[#78350f]">
              Security & Banking Requirements:{" "}
              <span className="font-normal text-[#92400e]">
                US accounts only. Routing number must be exactly 9 digits.
                Account numbers range between 4–17 digits. For fraud
                protection, only the last 4 digits remain visible after
                submission.
              </span>
            </p>
          </div>
        </div>

        {settings.hasManualBank && !editingBank ? (
          <>
            <dl className="mt-5 grid gap-6 bg-[rgba(248,250,252,0.4)] p-7 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Account holder
                </dt>
                <dd className="mt-1 text-[16px] font-semibold leading-6 text-[#0f172a]">
                  {settings.manualBankHolderName || "—"}
                </dd>
                <p className="mt-1 text-[12px] text-[#64748b]">
                  {settings.manualBankAccountType === "savings"
                    ? "Individual Savings"
                    : "Individual Checking"}
                </p>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Bank institution
                </dt>
                <dd className="mt-1 text-[16px] font-semibold leading-6 text-[#0f172a]">
                  {settings.manualBankName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Account number
                </dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-[16px] font-bold tracking-[0.05em] text-[#0f172a]">
                  {maskLast4(settings.manualBankLast4)}
                  {settings.manualBankAccountType ? (
                    <span className="rounded-[4px] bg-[rgba(226,232,240,0.7)] px-2 py-0.5 font-sans text-[11px] font-semibold tracking-normal text-[#334155]">
                      {settings.manualBankAccountType === "savings"
                        ? "Savings"
                        : "Checking"}
                    </span>
                  ) : null}
                </dd>
                <p className="mt-1 text-[12px] text-[#94a3b8]">
                  Direct deposit enabled
                </p>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                  Routing (ABA / ACH)
                </dt>
                <dd className="mt-1 font-mono text-[16px] font-bold tracking-[0.05em] text-[#0f172a]">
                  {maskLast4(settings.manualBankRoutingLast4)}
                </dd>
                <p className="mt-1 text-[12px] font-medium text-[#059669]">
                  Last 4 on file
                </p>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(226,232,240,0.8)] px-6 py-4">
              <button
                type="button"
                onClick={beginEditBank}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#cbd5e1] bg-white px-[17px] py-[9px] text-[14px] font-medium leading-5 text-[#1e293b] shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/figma/payout/edit.svg" alt="" width={16} height={16} />
                Edit bank details
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#e2e8f0] bg-white px-[17px] py-[9px] text-[14px] font-medium leading-5 text-[#e11d48] disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/figma/payout/trash.svg" alt="" width={16} height={16} />
                Remove bank
              </button>
            </div>
          </>
        ) : null}

        {!settings.hasManualBank && !editingBank ? (
          <button
            type="button"
            onClick={beginAddBank}
            className="mx-7 my-6 flex w-[calc(100%-3.5rem)] flex-col items-center rounded-[16px] border-2 border-dashed border-[#e2e8f0] bg-white/60 px-6 py-8 text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-[12px] bg-[#f1f5f9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma/payout/plus.svg" alt="" width={24} height={24} />
            </span>
            <span className="mt-3 text-[14px] font-semibold leading-5 text-[#0f172a]">
              Add a US bank account
            </span>
            <span className="mt-1 max-w-[390px] text-[12px] leading-4 text-[#64748b]">
              Save routing and account details for ACH direct deposit. Only the
              last 4 digits stay on screen.
            </span>
            <span className="mt-4 text-[12px] font-medium leading-4 text-[#4f46e5]">
              Add bank →
            </span>
          </button>
        ) : null}

          {editingBank ? (
            <form onSubmit={handleSaveBank} className="space-y-4 px-7 py-6" autoComplete="off">
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
