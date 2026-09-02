"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { uploadTaskReceiptAction } from "@/features/tasks/actions/task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { dashboardReceiptFileSrc } from "@/lib/api/task-media";
import { cn } from "@/lib/utils/cn";
import {
  formatFileSize,
  isAllowedReceiptFile,
  isReceiptImage,
  isReceiptRejected,
  isReceiptSent,
  RECEIPT_ACCEPT,
  RECEIPT_MAX_FILE_BYTES,
  RECEIPT_NOTE_MAX,
  receiptStatusLabel,
  type TaskReceipt,
  type TaskReceiptStatus,
} from "@/types/receipt";

const CLOSED_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
]);

type PaymentProofPanelProps = {
  taskId: string;
  taskStatus?: string | null;
  receipt: TaskReceipt | null;
  disabled?: boolean;
  onChanged?: (receipt: TaskReceipt) => void;
};

function statusVariant(
  status: TaskReceiptStatus,
): "warning" | "success" | "danger" | "muted" {
  if (status === "PENDING" || status === "ACCEPTED") return "success";
  if (status === "REJECTED") return "danger";
  return "muted";
}

function badgeLabel(status: TaskReceiptStatus): string {
  if (status === "PENDING" || status === "ACCEPTED") return "Sent";
  if (status === "REJECTED") return "Needs replace";
  return "Replaced";
}

function FileRow({
  name,
  mimeType,
  size,
  url,
  onRemove,
}: {
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  onRemove?: () => void;
}) {
  const showImage = isReceiptImage(mimeType, name) && url;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- local/data preview URLs
        <img src={url} alt="" className="size-10 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-hover text-xs font-semibold text-muted">
          FILE
        </span>
      )}
      <span className="min-w-0 flex-1">
        {url && !onRemove ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-accent hover:text-accent-hover"
          >
            {name || "Document file"}
          </a>
        ) : (
          <span className="block truncate text-sm font-medium text-foreground">
            {name || "Document file"}
          </span>
        )}
        <span className="text-xs text-muted">{formatFileSize(size)}</span>
      </span>
      {onRemove ? (
        <button
          type="button"
          className="text-sm font-semibold text-muted hover:text-foreground"
          onClick={onRemove}
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}

export function PaymentProofPanel({
  taskId,
  taskStatus,
  receipt,
  disabled = false,
  onChanged,
}: PaymentProofPanelProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(receipt?.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(!receipt);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!receipt) {
      setShowForm(true);
      return;
    }
    setNote((current) => current.trim() || receipt.note || "");
    if (isReceiptRejected(receipt) || receipt.status === "SUPERSEDED") {
      setShowForm(true);
      return;
    }
    setShowForm(false);
    setFile(null);
  }, [receipt]);

  const previewUrl = useMemo(() => {
    if (!file || !isReceiptImage(file.type, file.name)) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const closed = CLOSED_STATUSES.has(taskStatus ?? "");
  const canSend = !disabled && !closed;
  const sent = isReceiptSent(receipt);
  const rejected = isReceiptRejected(receipt);
  const formOpen =
    canSend &&
    (showForm || !receipt || rejected || receipt.status === "SUPERSEDED");
  const fileHref = receipt
    ? dashboardReceiptFileSrc(taskId, receipt.id)
    : "";

  function pickFile(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;
    if (!isAllowedReceiptFile(next)) {
      toast(
        next.size > RECEIPT_MAX_FILE_BYTES
          ? `${next.name} is too large (max 15 MB).`
          : `${next.name} is not a supported file type.`,
        "error",
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function send() {
    if (!file) {
      toast("Choose a file first.", "error");
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("file", file);
      if (note.trim()) form.set("note", note.trim().slice(0, RECEIPT_NOTE_MAX));
      const result = await uploadTaskReceiptAction(taskId, form);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast(
        receipt
          ? "Document replaced. You can complete the task now."
          : "Document sent. You can complete the task now.",
        "success",
      );
      setShowForm(false);
      setFile(null);
      onChanged?.(result.receipt);
    });
  }

  return (
    <section
      id="panel-receipt"
      className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Upload document
          </h2>
          <p className="mt-1 text-sm text-muted">
            Send a receipt or any relevant file to the client. You can replace
            it before completing the task — no client approval needed.
          </p>
        </div>
        {receipt ? (
          <Badge variant={statusVariant(receipt.status)}>
            {badgeLabel(receipt.status)}
          </Badge>
        ) : null}
      </div>

      {receipt ? (
        <div
          className={cn(
            "mt-4 rounded-xl border px-4 py-3",
            sent && "border-emerald-200 bg-emerald-50",
            rejected && "border-red-200 bg-red-50",
            receipt.status === "SUPERSEDED" && "border-border bg-surface-hover",
          )}
        >
          <p className="text-sm font-semibold text-foreground">
            {receiptStatusLabel(receipt.status)}
          </p>
          {sent ? (
            <p className="mt-0.5 text-sm text-muted">
              The client can view this file. You can complete the task now, or
              replace the file if you uploaded the wrong one.
            </p>
          ) : null}
          {rejected && receipt.rejectReason ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              Reason: {receipt.rejectReason}
            </p>
          ) : null}
          {receipt.note ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {receipt.note}
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            <FileRow
              name={receipt.fileName}
              mimeType={receipt.mimeType}
              size={receipt.fileSize}
              url={fileHref}
            />
          </ul>
        </div>
      ) : closed ? null : (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-hover px-3 py-2 text-sm text-muted">
          No document yet. Upload one after the client confirms the booking
          details.
        </p>
      )}

      {canSend && receipt && !formOpen ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-accent hover:text-accent-hover"
          onClick={() => setShowForm(true)}
        >
          Replace document
        </button>
      ) : null}

      {formOpen ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <Label htmlFor="receipt-file">
              {receipt ? "Replacement file" : "Document file"}
            </Label>
            <input
              ref={inputRef}
              id="receipt-file"
              type="file"
              accept={RECEIPT_ACCEPT}
              className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-accent"
              disabled={pending}
              onChange={(event) => pickFile(event.target.files)}
            />
            <p className="mt-1 text-xs text-muted">
              JPG, PNG, WebP, GIF, HEIC, PDF, Word, Excel, or text. Max 15 MB.
            </p>
          </div>

          {file ? (
            <ul className="space-y-2">
              <FileRow
                name={file.name}
                mimeType={file.type}
                size={file.size}
                url={previewUrl}
                onRemove={() => setFile(null)}
              />
            </ul>
          ) : null}

          <div>
            <Label htmlFor="receipt-note">Note (optional)</Label>
            <Textarea
              id="receipt-note"
              className="min-h-24"
              value={note}
              onChange={(event) =>
                setNote(event.target.value.slice(0, RECEIPT_NOTE_MAX))
              }
              disabled={pending}
              placeholder="Booking confirmation from Universal Cinemas"
              maxLength={RECEIPT_NOTE_MAX}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={pending}
              disabled={pending}
              onClick={send}
            >
              {receipt ? "Replace and send" : "Send to client"}
            </Button>
            {receipt && showForm && sent ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setShowForm(false);
                  setFile(null);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {closed ? (
        <p className="mt-3 text-sm text-muted">
          This task is closed. You cannot upload a document.
        </p>
      ) : null}
    </section>
  );
}
