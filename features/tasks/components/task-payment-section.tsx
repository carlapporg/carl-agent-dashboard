"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestApprovalAction } from "@/features/tasks/actions/task-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { PaymentAuthorization, VirtualCardSummary } from "@/types/payment";

type TaskPaymentSectionProps = {
  taskId: string;
  authorizations: PaymentAuthorization[];
  card?: VirtualCardSummary | null;
  disabled?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  expired: "Expired",
  spent: "Spent",
};

export function TaskPaymentSection({
  taskId,
  authorizations,
  card = null,
  disabled = false,
}: TaskPaymentSectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  const latest = authorizations[0];
  const showCard =
    card &&
    latest &&
    (latest.status === "approved" || latest.status === "spent");

  return (
    <section
      id="panel-payment"
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-sm font-semibold text-foreground">Payment</h2>
      <p className="mt-1 text-sm text-muted">
        Request client approval before continuing. Card details appear only after
        approval.
      </p>

      {authorizations.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {authorizations.map((auth) => {
            const approved =
              auth.approvedAmount ??
              (auth.status === "approved" || auth.status === "spent"
                ? auth.amount
                : undefined);
            return (
              <li
                key={auth.id}
                className="rounded-lg border border-border bg-[#f8fafc] px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    ${auth.amount.toFixed(0)} · {auth.merchant}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      auth.status === "approved" || auth.status === "spent"
                        ? "bg-emerald-50 text-emerald-700"
                        : auth.status === "declined" || auth.status === "expired"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800",
                    )}
                  >
                    {STATUS_LABEL[auth.status] ?? auth.status}
                  </span>
                </div>
                {auth.merchantCategory ? (
                  <p className="mt-0.5 text-muted">{auth.merchantCategory}</p>
                ) : null}
                {auth.description ? (
                  <p className="mt-0.5 text-muted">{auth.description}</p>
                ) : null}
                {approved != null && approved < auth.amount ? (
                  <p className="mt-1 text-xs font-medium text-foreground-soft">
                    Partially approved: ${approved.toFixed(0)} of $
                    {auth.amount.toFixed(0)}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-dim">
                  Remaining ${auth.remaining.toFixed(0)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showCard ? (
        <div className="mt-3 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2.5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Virtual card
          </p>
          <p className="mt-1 font-medium text-foreground">
            {card.network.toUpperCase()} ···· {card.last4}
          </p>
          <p className="mt-0.5 text-muted">
            Limit ${card.spendingLimit.toFixed(0)} · Remaining $
            {card.remaining.toFixed(0)}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className="mt-3 text-sm font-semibold text-accent hover:text-accent-hover"
        onClick={() => setLogOpen((v) => !v)}
      >
        {logOpen ? "Hide" : "Show"} transaction log
      </button>
      {logOpen ? (
        <ul className="mt-2 space-y-1.5 text-sm text-muted">
          {authorizations.length === 0 ? (
            <li>No transactions yet.</li>
          ) : (
            authorizations.map((a) => (
              <li key={`log-${a.id}`}>
                {STATUS_LABEL[a.status]} · ${a.amount.toFixed(0)} · {a.merchant}{" "}
                · {new Date(a.requestedAt).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      ) : null}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || pending) return;
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            await requestApprovalAction(taskId, formData);
            setAmount("");
            setMerchant("");
            setDescription("");
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor="pay-amount">Amount (USD)</Label>
          <Input
            id="pay-amount"
            name="amount"
            type="number"
            min="1"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled || pending}
            placeholder="1200"
          />
        </div>
        <div>
          <Label htmlFor="pay-merchant">Merchant</Label>
          <Input
            id="pay-merchant"
            name="merchant"
            required
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            disabled={disabled || pending}
            placeholder="Merchant name"
          />
        </div>
        <div>
          <Label htmlFor="pay-category">Category</Label>
          <Input
            id="pay-category"
            name="merchantCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={disabled || pending}
            placeholder="Hotels"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pay-desc">Description</Label>
          <Textarea
            id="pay-desc"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled || pending}
            rows={2}
            placeholder="What this payment covers"
            className="min-h-16"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={disabled || pending} loading={pending}>
            Send payment request
          </Button>
        </div>
      </form>
    </section>
  );
}
