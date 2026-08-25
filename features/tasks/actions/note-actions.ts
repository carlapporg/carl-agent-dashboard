"use server";

import { notesApi } from "@/lib/api/notes";
import type { AgentNote } from "@/types/note";

export async function listNotesAction(taskId: string): Promise<AgentNote[]> {
  return notesApi.list(taskId);
}

export async function getNoteAction(
  taskId: string,
  noteId: string,
): Promise<AgentNote> {
  return notesApi.get(taskId, noteId);
}

export async function createNoteAction(
  taskId: string,
  content: string,
): Promise<AgentNote> {
  return notesApi.create(taskId, content);
}

export async function updateNoteAction(
  taskId: string,
  noteId: string,
  content: string,
): Promise<AgentNote> {
  return notesApi.update(taskId, noteId, content);
}
