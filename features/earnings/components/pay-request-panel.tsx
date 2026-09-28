"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPayOptionsAction,
  requestPayAction,
} from "@/features/earnings/actions";
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

function formatPeriod(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function clampDay(value: string) {
  const today = todayInput();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return today;
  return value;
}

export function PayRequestPanel() {
  const queryClient = useQueryClient();
  const [justSent, setJustSent] = useState<PayRecord | null>(null);
  const [day, setDay] = useState(todayInput);
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
      setJustSent(pay);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.earnings.all,
      });
    },
  });

  const options = optionsQuery.data;
  const waiting = options?.openRequest ?? justSent;

  return (
    <section className="rounded-[15px] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
      <h2 className="text-[18px] font-semibold tracking-[-0.04em] text-foreground">
        Ask for pay
      </h2>
      <p className="mt-1 text-sm text-muted">
        Weekly, biweekly, or monthly. One request at a time. One day is for testing.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted">
        Test day
        <input
          type="date"
          value={day}
          max={todayInput()}
          onChange={(event) => setDay(clampDay(event.target.value))}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground"
        />
      </label>

      {optionsQuery.isPending && !options ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
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

      {waiting ? (
        <div className="mt-4 rounded-[12px] border border-warning bg-warning-soft px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-warning-foreground">
            Waiting
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {label(waiting.mode)} pay is waiting for review.
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatPeriod(waiting.periodStart)} – {formatPeriod(waiting.periodEnd)}
          </p>
        </div>
      ) : options ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {options.choices.map((choice) => {
            const locked = !choice.enabled || request.isPending;
            return (
              <button
                key={choice.mode}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!choice.enabled || request.isPending) return;
                  request.mutate(choice.mode);
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
                {choice.periodStart && choice.periodEnd ? (
                  <p className="mt-1 text-[12px] text-muted">
                    {formatPeriod(choice.periodStart)} – {formatPeriod(choice.periodEnd)}
                  </p>
                ) : null}
                {!choice.enabled && choice.reason ? (
                  <p className="mt-1 text-xs text-muted">{choice.reason}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

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
