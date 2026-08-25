"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import {
  createNoteAction,
  listNotesAction,
  updateNoteAction,
} from "@/features/tasks/actions/note-actions";

const PLACEHOLDER =
  "this is your personal notes no client see them or anything";

type TaskAgentNotesProps = {
  taskId: string;
  disabled?: boolean;
};

export function TaskAgentNotes({ taskId, disabled = false }: TaskAgentNotesProps) {
  const { toast } = useToast();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listNotesAction(taskId)
      .then((rows) => {
        if (cancelled) return;
        const latest = rows[0];
        setNoteId(latest?.id ?? null);
        setDraft(latest?.content ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        toast(
          error instanceof Error ? error.message : "Could not load notes.",
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  function save() {
    const content = draft.trim();
    if (!content) return;
    startTransition(async () => {
      try {
        const saved = noteId
          ? await updateNoteAction(taskId, noteId, content)
          : await createNoteAction(taskId, content);
        setNoteId(saved.id);
        setDraft(saved.content);
        toast("Note saved.", "success");
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Could not save note.",
          "error",
        );
      }
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Agent notes</h2>
      <Textarea
        className="mt-3 min-h-28"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={PLACEHOLDER}
        maxLength={20000}
        disabled={disabled || loading || pending}
      />
      <div className="mt-2">
        <Button
          type="button"
          loading={pending}
          disabled={disabled || loading || pending || !draft.trim()}
          onClick={save}
        >
          Save note
        </Button>
      </div>
    </section>
  );
}
