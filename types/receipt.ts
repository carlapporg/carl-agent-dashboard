import { z } from "zod";

export const RECEIPT_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/heic,.pdf,.doc,.docx,.xls,.xlsx,.txt";

export const RECEIPT_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const RECEIPT_NOTE_MAX = 2000;

export const taskReceiptStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);

export type TaskReceiptStatus = z.infer<typeof taskReceiptStatusSchema>;

export const taskReceiptSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    taskId: z.union([z.string(), z.number()]).transform(String),
    agentId: z.union([z.string(), z.number()]).transform(String).optional(),
    userId: z.union([z.string(), z.number()]).transform(String).optional(),
    status: taskReceiptStatusSchema,
    fileName: z.string().optional().default(""),
    mimeType: z.string().optional().default(""),
    fileSize: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((value) => {
        if (value == null || value === "") return 0;
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      }),
    note: z.string().nullable().optional(),
    rejectReason: z.string().nullable().optional(),
    fileUrl: z.string().optional().default(""),
    agentFileUrl: z.string().optional().default(""),
    createdAt: z.string().optional().default(""),
    updatedAt: z.string().optional().default(""),
    decidedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type TaskReceipt = z.infer<typeof taskReceiptSchema>;

export function parseTaskReceiptPayload(payload: unknown): TaskReceipt | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  for (const candidate of [root.data, root.receipt, payload]) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const hasFile =
      (typeof row.fileName === "string" && row.fileName) ||
      (typeof row.agentFileUrl === "string" && row.agentFileUrl) ||
      (typeof row.fileUrl === "string" && row.fileUrl) ||
      (typeof row.mimeType === "string" && row.mimeType);
    if (!hasFile) continue;
    const parsed = taskReceiptSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export function isReceiptPending(
  receipt?: Pick<TaskReceipt, "status"> | null,
): boolean {
  return receipt?.status === "PENDING";
}

export function isReceiptAccepted(
  receipt?: Pick<TaskReceipt, "status"> | null,
): boolean {
  return receipt?.status === "ACCEPTED";
}

export function isReceiptRejected(
  receipt?: Pick<TaskReceipt, "status"> | null,
): boolean {
  return receipt?.status === "REJECTED";
}

export function receiptStatusLabel(status: TaskReceiptStatus): string {
  switch (status) {
    case "PENDING":
      return "Waiting for user to review receipt";
    case "ACCEPTED":
      return "User accepted the receipt";
    case "REJECTED":
      return "User rejected the receipt";
    case "SUPERSEDED":
      return "Replaced by a newer receipt";
  }
}

export function isAllowedReceiptFile(file: File): boolean {
  if (file.size > RECEIPT_MAX_FILE_BYTES) return false;
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  if (
    file.type === "application/msword" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return true;
  }
  if (
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return true;
  }
  if (file.type === "text/plain") return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|pdf|docx?|xlsx?|txt)$/i.test(file.name);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isReceiptImage(mimeType: string, fileName = ""): boolean {
  if (mimeType.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(fileName);
}
