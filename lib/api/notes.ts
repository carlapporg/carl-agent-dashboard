import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { AgentNote } from "@/types/note";

const noteSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
  title: z.string().nullable().optional(),
  content: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

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
    const rows = await apiRequest(API_ENDPOINTS.agents.taskNotes(taskId), {
      method: "GET",
      schema: z.array(noteSchema),
    });
    return rows.map((row) => normalize(taskId, row));
  },

  async get(taskId: string, noteId: string): Promise<AgentNote> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskNote(taskId, noteId), {
      method: "GET",
      schema: noteSchema,
    });
    return normalize(taskId, row);
  },

  async create(taskId: string, content: string): Promise<AgentNote> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskNotes(taskId), {
      method: "POST",
      body: { content },
      schema: noteSchema,
      dedupe: false,
    });
    return normalize(taskId, row);
  },

  async update(
    taskId: string,
    noteId: string,
    content: string,
  ): Promise<AgentNote> {
    const row = await apiRequest(API_ENDPOINTS.agents.taskNote(taskId, noteId), {
      method: "PATCH",
      body: { content },
      schema: noteSchema,
      dedupe: false,
    });
    return normalize(taskId, row);
  },
};
