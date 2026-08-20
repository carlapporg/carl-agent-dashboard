"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SlaCountdown } from "@/features/dashboard/components/sla-countdown";
import { useTaskQueueSocket } from "@/hooks/use-task-queue-socket";
import { dashboardApi } from "@/lib/api/dashboard";
import { ROUTES } from "@/lib/constants/routes";
import type { QueuePreviewItem } from "@/types/dashboard";

export function LiveQueuePreview() {
  const [items, setItems] = useState<QueuePreviewItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { isConnected, configured } = useTaskQueueSocket({
    onEvent: () => {
      void dashboardApi.getQueuePreview(3).then(setItems);
    },
  });

  useEffect(() => {
    let cancelled = false;
    void dashboardApi.getQueuePreview(3).then((data) => {
      if (!cancelled) {
        setItems(data);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Live queue preview
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Assigned / incoming work ·{" "}
            {configured
              ? isConnected
                ? "live"
                : "waiting for socket"
              : "mock feed"}
          </p>
        </div>
        <Link
          href={ROUTES.tasks}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          Open full queue
        </Link>
      </div>

      {!loaded ? (
        <p className="mt-4 text-sm text-muted">Loading queue…</p>
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-[#f8fafc] px-4 py-10 text-center">
          <span
            className="mb-3 size-2 animate-pulse rounded-full bg-accent"
            aria-hidden
          />
          <p className="text-sm font-medium text-foreground-soft">
            No tasks in queue right now
          </p>
          <p className="mt-1 text-xs text-muted">Waiting for the next assignment…</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={ROUTES.task(item.id)}
                className="block rounded-lg border border-border px-3 py-3 transition-colors hover:border-accent/30 hover:bg-accent/[0.03]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {item.taskType}
                      {item.tier === "vip" ? " · VIP" : ""}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      #{item.number} {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {item.summary}
                    </p>
                  </div>
                  <SlaCountdown expiresAt={item.expiresAt} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
