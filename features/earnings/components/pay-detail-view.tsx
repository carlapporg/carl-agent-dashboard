"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPayAction } from "@/features/earnings/actions";
import { ROUTES } from "@/lib/constants/routes";
import { queryKeys } from "@/lib/query/keys";

function money(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleCase(value: string) {
  return value.replaceAll("_", " ");
}

export function PayDetailView({ payId }: { payId: string }) {
  const query = useQuery({
    queryKey: queryKeys.earnings.pay(payId),
    queryFn: async () => {
      const result = await getPayAction(payId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted">Loading pay…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <p className="text-sm text-muted">
        {query.error instanceof Error ? query.error.message : "Pay not found."}
      </p>
    );
  }

  const pay = query.data;
  return (
    <div className="space-y-4">
      <header>
        <Link
          href={ROUTES.earnings}
          className="text-[12px] font-semibold text-accent hover:text-accent-hover"
        >
          Back to earnings
        </Link>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-foreground">
          Pay
        </h1>
        <p className="mt-1 text-sm capitalize text-muted">
          {titleCase(pay.mode)} · {titleCase(pay.status)}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Amount" value={money(pay.amountCents)} />
        <Stat label="Hours" value={`${pay.hoursWorked}h`} />
        <Stat
          label="Rate"
          value={
            pay.hourlyRateCents != null
              ? `${money(pay.hourlyRateCents)}/hr`
              : "—"
          }
        />
      </section>

      <section className="rounded-[15px] border border-border bg-surface p-4 text-sm shadow-[var(--shadow-card)] md:p-5">
        <p className="text-foreground">
          {when(pay.periodStart)} to {when(pay.periodEnd)}
        </p>
        <p className="mt-2 text-muted">
          Available {pay.availableHours}h · Busy {pay.busyHours}h
        </p>
        {pay.method ? (
          <p className="mt-2 text-muted">Method: {pay.method}</p>
        ) : null}
        {pay.paidAt ? (
          <p className="mt-1 text-muted">Paid {when(pay.paidAt)}</p>
        ) : null}
        {pay.proofUrl ? (
          <p className="mt-3">
            <a
              href={pay.proofUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:text-accent-hover"
            >
              View payment proof
            </a>
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[15px] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-foreground">Timesheet</h2>
        </div>
        {pay.timesheet.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted md:px-5">
            No timesheet lines.
          </p>
        ) : (
          <ul>
            {pay.timesheet.map((row, index) => (
              <li
                key={`${row.startedAt}-${row.status}-${index}`}
                className="border-b border-border px-4 py-3 text-sm last:border-b-0 md:px-5"
              >
                <p className="font-medium capitalize text-foreground">
                  {titleCase(row.status)}
                </p>
                <p className="mt-0.5 text-muted">
                  {when(row.startedAt)}
                  {row.endedAt ? ` to ${when(row.endedAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-foreground">
        {value}
      </p>
    </div>
  );
}
