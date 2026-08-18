import Link from "next/link";
import {
  acceptTaskAction,
  addTaskNoteAction,
  sendUpdateAction,
  toggleStepAction,
  updateTaskStatusAction,
} from "@/features/tasks/actions/task-actions";
import {
  PriorityBadge,
  StatusBadge,
  formatStatus,
} from "@/features/tasks/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/constants/routes";
import type { TimelineEvent } from "@/types/message";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_OPTIONS: TaskStatus[] = [
  "queued",
  "assigned",
  "in_progress",
  "waiting_for_customer",
  "waiting_for_payment",
  "completed",
  "cancelled",
];

type TaskBriefPaneProps = {
  task: Task;
  timeline: TimelineEvent[];
};

export function TaskBriefPane({ task, timeline }: TaskBriefPaneProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-dim">Task #{task.number}</span>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {task.title}
        </h1>
        <p className="text-base leading-relaxed text-muted">{task.request}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {task.status === "queued" ? (
            <form action={acceptTaskAction.bind(null, task.id)}>
              <Button type="submit">Accept task</Button>
            </form>
          ) : null}
          <Link
            href={ROUTES.taskPayments(task.id)}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface-elevated px-5 text-base font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Payments & receipts
          </Link>
        </div>
      </header>

      {task.aiBrief ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
            AI brief
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground-soft">
            {task.aiBrief.summary}
          </p>
          {task.aiBrief.missingInfo.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-foreground">Missing info</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {task.aiBrief.missingInfo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {task.aiBrief.suggestedActions.length > 0 ? (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Suggested next steps
              </p>
              {task.aiBrief.suggestedActions.map((step) => {
                const done = task.suggestedStepsDone.includes(step);
                return (
                  <form
                    key={step}
                    action={toggleStepAction.bind(null, task.id, step)}
                  >
                    <button
                      type="submit"
                      className="flex w-full items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover"
                    >
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
                          done
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border"
                        }`}
                        aria-hidden
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span
                        className={
                          done
                            ? "text-muted line-through"
                            : "text-foreground-soft"
                        }
                      >
                        {step}
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Update status
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <form
              key={status}
              action={updateTaskStatusAction.bind(null, task.id, status)}
            >
              <Button
                type="submit"
                variant={task.status === status ? "primary" : "secondary"}
                className="h-10 text-sm"
              >
                {formatStatus(status)}
              </Button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Agent notes
        </h2>
        <ul className="mt-3 space-y-3">
          {task.notes.length === 0 ? (
            <li className="text-sm text-muted">No notes yet.</li>
          ) : (
            task.notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border border-border/80 bg-surface-elevated px-3 py-2.5"
              >
                <p className="text-sm text-foreground-soft">{note.body}</p>
                <p className="mt-1 text-xs text-muted-dim">
                  {note.authorName} ·{" "}
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
        <form
          action={addTaskNoteAction.bind(null, task.id)}
          className="mt-4 space-y-3"
        >
          <Textarea name="body" placeholder="Add an internal note…" required />
          <Button type="submit" variant="secondary">
            Save note
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-dim">
          Timeline
        </h2>
        <ul className="mt-4 space-y-3">
          {timeline.length === 0 ? (
            <li className="text-sm text-muted">No updates yet.</li>
          ) : (
            timeline.map((event) => (
              <li key={event.id} className="border-l-2 border-border pl-3">
                <p className="text-sm text-foreground-soft">{event.body}</p>
                <p className="mt-1 text-xs text-muted-dim">
                  {event.authorName ? `${event.authorName} · ` : ""}
                  {new Date(event.createdAt).toLocaleString()}
                  {event.visibleToCustomer ? " · visible to customer" : ""}
                </p>
              </li>
            ))
          )}
        </ul>
        <form
          action={sendUpdateAction.bind(null, task.id)}
          className="mt-4 space-y-3"
        >
          <Textarea
            name="body"
            placeholder="Send a customer-visible update…"
            required
          />
          <Button type="submit">Send update</Button>
        </form>
      </section>
    </div>
  );
}
