"use client";

type TaskAiBriefProps = {
  summary?: string;
  missingInfo?: string[];
  onAskMissing?: (item: string) => void;
};

/** Compact brief — suggested actions live in Task steps, not duplicated here. */
export function TaskAiBrief({
  summary,
  missingInfo = [],
  onAskMissing,
}: TaskAiBriefProps) {
  if (!summary && missingInfo.length === 0) return null;

  return (
    <section
      id="panel-brief"
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-sm font-semibold text-foreground">Brief</h2>
      {summary ? (
        <p className="mt-2 text-sm leading-relaxed text-foreground-soft">
          {summary}
        </p>
      ) : null}

      {missingInfo.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Need from client
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missingInfo.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onAskMissing?.(item)}
                  className="rounded-full border border-border bg-[#f8fafc] px-3 py-1.5 text-sm text-foreground-soft transition-colors hover:border-accent/40 hover:text-accent"
                >
                  Ask: {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
