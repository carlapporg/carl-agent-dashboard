"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  updateTaskAgentStatusAction,
  uploadTaskReceiptAction,
} from "@/features/tasks/actions/task-actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import {
  formatFileSize,
  isAllowedReceiptFile,
  isReceiptImage,
  isReceiptSent,
  RECEIPT_ACCEPT,
  RECEIPT_MAX_FILE_BYTES,
  RECEIPT_NOTE_MAX,
  type TaskReceipt,
} from "@/types/receipt";

type CompleteTaskReceiptDialogProps = {
  open: boolean;
  taskId: string;
  receipt: TaskReceipt | null;
  onClose: () => void;
  onCompleted: (receipt: TaskReceipt | null) => void;
};

export function CompleteTaskReceiptDialog({
  open,
  taskId,
  receipt,
  onClose,
  onCompleted,
}: CompleteTaskReceiptDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const alreadySent = isReceiptSent(receipt);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setNote(receipt?.note?.trim() || "");
    if (inputRef.current) inputRef.current.value = "";
  }, [open, receipt?.note]);

  const previewUrl = useMemo(() => {
    if (!file || !isReceiptImage(file.type, file.name)) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  function markCompleted(nextReceipt: TaskReceipt | null) {
    startTransition(async () => {
      const result = await updateTaskAgentStatusAction(taskId, "COMPLETED");
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast("Task completed.", "success");
      onCompleted(nextReceipt);
    });
  }

  function submit() {
    if (alreadySent && !file) {
      markCompleted(receipt);
      return;
    }
    if (!file) {
      toast("Upload a payment receipt or document to complete.", "error");
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("file", file);
      if (note.trim()) form.set("note", note.trim().slice(0, RECEIPT_NOTE_MAX));
      const uploaded = await uploadTaskReceiptAction(taskId, form);
      if (!uploaded.ok) {
        toast(uploaded.message, "error");
        return;
      }
      const result = await updateTaskAgentStatusAction(taskId, "COMPLETED");
      if (!result.ok) {
        toast(result.message, "error");
        onCompleted(uploaded.receipt);
        return;
      }
      toast("Document sent and task completed.", "success");
      onCompleted(uploaded.receipt);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Upload document to complete"
      description="Send the payment receipt or any relevant file to the client. The task will be marked Completed after it is sent."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {alreadySent && !file ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-foreground">
            A document is already on this task ({receipt?.fileName || "file"}).
            Complete now, or choose a replacement file below.
          </p>
        ) : null}

        <div>
          <Label htmlFor="complete-receipt-file">
            {alreadySent ? "Replacement file (optional)" : "Payment receipt / document"}
          </Label>
          <input
            ref={inputRef}
            id="complete-receipt-file"
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
          <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview URL
              <img
                src={previewUrl}
                alt=""
                className="size-10 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-hover text-xs font-semibold text-muted">
                FILE
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {file.name}
              </span>
              <span className="text-xs text-muted">{formatFileSize(file.size)}</span>
            </span>
            <button
              type="button"
              className="text-sm font-semibold text-muted hover:text-foreground"
              disabled={pending}
              onClick={() => setFile(null)}
            >
              Remove
            </button>
          </div>
        ) : null}

        <div>
          <Label htmlFor="complete-receipt-note">Note (optional)</Label>
          <Textarea
            id="complete-receipt-note"
            className="min-h-20"
            value={note}
            onChange={(event) =>
              setNote(event.target.value.slice(0, RECEIPT_NOTE_MAX))
            }
            disabled={pending}
            placeholder="Payment receipt / booking confirmation"
            maxLength={RECEIPT_NOTE_MAX}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={pending || (!alreadySent && !file)}
            onClick={submit}
          >
            {alreadySent && !file ? "Complete task" : "Upload & complete"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
