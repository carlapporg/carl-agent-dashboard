import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { AgentNote } from "@/types/note";

const noteSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  taskId: z.union([z.string(), z.number()]).transform(String).optional(),
  agentId: z.string().optional(),
  title: z.string().nullable().optional(),
  content: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

function extractNoteRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.notes)) return record.notes;
  if (Array.isArray(record.data)) return record.data;
  if (record.id != null) return [record];
  return [];
}

function normalize(taskId: string, row: z.infer<typeof noteSchema>): AgentNote {
  return {
    id: row.id,
    taskId: row.taskId ?? taskId,
    title: row.title ?? null,
    content: row.content ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

export const notesApi = {
  async list(taskId: string): Promise<AgentNote[]> {
    const data = await apiRequest(API_ENDPOINTS.agents.taskNotes(taskId), {
      method: "GET",
      schema: z.unknown(),
      looseEnvelope: true,
    });
    const rows: AgentNote[] = [];
    for (const row of extractNoteRows(data)) {
      const parsed = noteSchema.safeParse(row);
      if (parsed.success) rows.push(normalize(taskId, parsed.data));
    }
    return rows.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  },

  async get(taskId: string, noteId: string): Promise<AgentNote> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskNote(taskId, noteId),
      {
        method: "GET",
        schema: z.unknown(),
        looseEnvelope: true,
      },
    );
    const parsed = noteSchema.safeParse(
      extractNoteRows(data)[0] ?? data,
    );
    if (!parsed.success) {
      throw new Error("Unable to load this note.");
    }
    return normalize(taskId, parsed.data);
  },

  async create(taskId: string, content: string): Promise<AgentNote> {
    const data = await apiRequest(API_ENDPOINTS.agents.taskNotes(taskId), {
      method: "POST",
      body: { content },
      schema: z.unknown(),
      looseEnvelope: true,
      dedupe: false,
    });
    const parsed = noteSchema.safeParse(
      extractNoteRows(data)[0] ?? data,
    );
    if (!parsed.success) {
      throw new Error("Unable to save this note.");
    }
    return normalize(taskId, parsed.data);
  },

  async update(
    taskId: string,
    noteId: string,
    content: string,
  ): Promise<AgentNote> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskNote(taskId, noteId),
      {
        method: "PATCH",
        body: { content },
        schema: z.unknown(),
        looseEnvelope: true,
        dedupe: false,
      },
    );
    const parsed = noteSchema.safeParse(
      extractNoteRows(data)[0] ?? data,
    );
    if (!parsed.success) {
      throw new Error("Unable to update this note.");
    }
    return normalize(taskId, parsed.data);
  },
};
