"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/api/dashboard";
import type { AgentQuickStats } from "@/types/dashboard";

const REFRESH_MS = 3 * 60_000;

export function QuickStats() {
  const [stats, setStats] = useState<AgentQuickStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await dashboardApi.getQuickStats();
      if (!cancelled) setStats(data);
    }
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const cells = [
    { label: "Done today", value: stats?.completedToday ?? "—" },
    { label: "Done this week", value: stats?.completedWeek ?? "—" },
    {
      label: "Avg response",
      value: stats ? `${stats.avgResponseMins}m` : "—",
    },
    {
      label: "Rating",
      value: stats?.ratingAvg != null ? stats.ratingAvg.toFixed(1) : "—",
    },
  ];

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Quick stats</h2>
      <p className="mt-0.5 text-xs text-muted">
        Cached analytics · refreshes every few minutes
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="rounded-lg border border-border bg-[#f8fafc] px-3 py-2.5"
          >
            <p className="text-xs text-muted">{cell.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
