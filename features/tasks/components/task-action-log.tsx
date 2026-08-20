import type { TimelineEvent } from "@/types/message";
import { cn } from "@/lib/utils/cn";

type TaskActionLogProps = {
  timeline: TimelineEvent[];
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isAgentAuthored(e: TimelineEvent): boolean {
  return e.kind === "agent_message" || e.kind === "agent_note";
}

export function TaskActionLog({ timeline }: TaskActionLogProps) {
  const system = timeline.filter((e) => !isAgentAuthored(e));
  const agent = timeline.filter((e) => isAgentAuthored(e));

  return (
    <section
      id="panel-log"
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-sm font-semibold text-foreground">Action log</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <LogColumn title="System" events={system} tone="system" />
        <LogColumn title="Agent" events={agent} tone="agent" />
      </div>
    </section>
  );
}

function LogColumn({
  title,
  events,
  tone,
}: {
  title: string;
  events: TimelineEvent[];
  tone: "system" | "agent";
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-dim">No entries</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                tone === "system"
                  ? "border-border bg-[#f8fafc] text-foreground-soft"
                  : "border-accent/20 bg-accent/5 text-foreground-soft",
              )}
            >
              <p>{e.body}</p>
              <p className="mt-1 text-xs text-muted-dim">
                {formatTime(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
