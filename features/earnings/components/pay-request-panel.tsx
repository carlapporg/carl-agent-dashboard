"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPayOptionsAction,
  requestPayAction,
} from "@/features/earnings/actions";
import { useNotifications } from "@/features/notifications/notification-provider";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { PayMode, PayRecord } from "@/lib/api/earnings";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${date}`;
}

function label(mode: string) {
  if (mode === "weekly") return "Weekly";
  if (mode === "biweekly") return "Biweekly";
  if (mode === "daily") return "One day";
  return "Monthly";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPayRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "";
  const from = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  const exclusive = /^(\d{4})-(\d{2})-(\d{2})/.exec(end);
  if (!from || !exclusive) return "";
  const last = new Date(Date.UTC(Number(exclusive[1]), Number(exclusive[2]) - 1, Number(exclusive[3])));
  last.setUTCDate(last.getUTCDate() - 1);
  const startLabel = `${MONTHS[Number(from[2]) - 1]} ${Number(from[3])}, ${from[1]}`;
  const endLabel = `${MONTHS[last.getUTCMonth()]} ${last.getUTCDate()}, ${last.getUTCFullYear()}`;
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

function choiceDates(choice: {
  mode: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  unpaidRanges?: Array<{ periodStart: string; periodEnd: string }> | null;
}) {
  if (choice.mode === "monthly" && choice.unpaidRanges) {
    if (choice.unpaidRanges.length === 0) return "No unpaid days left";
    return choice.unpaidRanges
      .map((range) => formatPayRange(range.periodStart, range.periodEnd))
      .join(", ");
  }
  return formatPayRange(choice.periodStart, choice.periodEnd);
}

const DECLINED_NOTICE = "Your pay request was declined.";

export function PayRequestPanel() {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const [justSent, setJustSent] = useState<PayRecord | null>(null);
  const [declinedNotice, setDeclinedNotice] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<{
    mode: PayMode;
    periodStart?: string | null;
    periodEnd?: string | null;
    unpaidRanges?: Array<{ periodStart: string; periodEnd: string }> | null;
  } | null>(null);
  const seenRejectIds = useRef(new Set<string>());
  const ready = useRef(false);
  const day = todayInput();
  const optionsQuery = useQuery({
    queryKey: queryKeys.earnings.payOptions(day),
    queryFn: async () => {
      const result = await getPayOptionsAction(
        /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined,
      );
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 15_000,
  });

  const request = useMutation({
    mutationFn: async (mode: PayMode) => {
      const result = await requestPayAction(mode, mode === "daily" ? day : undefined);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (pay) => {
      setPendingChoice(null);
      setDeclinedNotice(null);
      setJustSent(pay);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.earnings.all,
      });
    },
    onError: () => setPendingChoice(null),
  });

  useEffect(() => {
    const rejects = notifications.items.filter(
      (item) => item.kind === "pay_rejected",
    );
    const fresh = ready.current
      ? rejects.filter((item) => !seenRejectIds.current.has(item.id))
      : rejects.filter((item) => !item.read);
    for (const item of rejects) seenRejectIds.current.add(item.id);
    ready.current = true;
    if (fresh.length === 0) return;
    setJustSent(null);
    setDeclinedNotice(DECLINED_NOTICE);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.earnings.all,
    });
  }, [notifications.items, queryClient]);

  const options = optionsQuery.data;
  const waiting = declinedNotice ? null : (options?.openRequest ?? justSent);

  return (
    <section className="rounded-[15px] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
      <h2 className="text-[18px] font-semibold tracking-[-0.04em] text-foreground">
        Ask for pay
      </h2>
      <p className="mt-1 text-sm text-muted">
        Weekly, biweekly, or monthly. One request at a time.
      </p>

      {optionsQuery.isPending && !options ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-[12px] bg-surface-muted"
            />
          ))}
        </div>
      ) : null}

      {optionsQuery.isError ? (
        <p className="mt-3 text-sm text-muted">
          {optionsQuery.error instanceof Error
            ? optionsQuery.error.message
            : "Can't load pay choices."}
        </p>
      ) : null}

      {declinedNotice ? (
        <p className="mt-4 text-sm text-foreground">{declinedNotice}</p>
      ) : null}

      {waiting ? (
        <div className="mt-4 rounded-[12px] border border-warning bg-warning-soft px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-warning-foreground">
            Waiting
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {label(waiting.mode)} pay is waiting for review.
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatPayRange(waiting.periodStart, waiting.periodEnd)}
          </p>
        </div>
      ) : options ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {options.choices.filter((choice) => choice.mode !== "daily").map((choice) => {
            const locked = !choice.enabled || request.isPending;
            return (
              <button
                key={choice.mode}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!choice.enabled || request.isPending) return;
                  setPendingChoice({
                    mode: choice.mode,
                    periodStart: choice.periodStart,
                    periodEnd: choice.periodEnd,
                    unpaidRanges: choice.unpaidRanges,
                  });
                }}
                className={cn(
                  "rounded-[12px] border border-border bg-surface px-4 py-3 text-left transition-colors",
                  choice.enabled
                    ? "hover:border-accent hover:bg-accent-soft"
                    : "cursor-not-allowed opacity-70",
                )}
              >
                <p className="text-sm font-semibold text-foreground">
                  {label(choice.mode)}
                </p>
                {choiceDates(choice) ? (
                  <p className="mt-1 text-[12px] text-muted">{choiceDates(choice)}</p>
                ) : null}
                {!choice.enabled && choice.reason ? (
                  <p className="mt-1 text-xs text-muted">{choice.reason}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingChoice != null}
        onClose={() => {
          if (!request.isPending) setPendingChoice(null);
        }}
        onConfirm={() => {
          if (!pendingChoice || request.isPending) return;
          request.mutate(pendingChoice.mode);
        }}
        title={`Ask for ${label(pendingChoice?.mode ?? "monthly").toLowerCase()} pay?`}
        description={
          pendingChoice && choiceDates(pendingChoice)
            ? `This sends a ${label(pendingChoice.mode).toLowerCase()} pay request for ${choiceDates(pendingChoice)}.`
            : "This sends the pay request for review."
        }
        confirmLabel="Send request"
        cancelLabel="Not now"
        loading={request.isPending}
      />

      {request.isError ? (
        <p className="mt-3 text-sm text-danger">
          {request.error instanceof Error
            ? request.error.message
            : "Couldn't send the request."}
        </p>
      ) : null}
    </section>
  );
}
