"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadReceiptAction } from "@/features/tasks/actions/task-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentAuthorization, Receipt } from "@/types/payment";

type TaskReceiptsProps = {
  taskId: string;
  receipts: Receipt[];
  authorizations: PaymentAuthorization[];
  disabled?: boolean;
};

export function TaskReceipts({
  taskId,
  receipts,
  authorizations,
  disabled = false,
}: TaskReceiptsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [authId, setAuthId] = useState(authorizations[0]?.id ?? "");

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Receipts</h2>
      <p className="mt-1 text-sm text-muted">
        Tie uploads to a payment authorization (mock).
      </p>

      {receipts.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {receipts.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border bg-[#f8fafc] px-3 py-2"
            >
              <p className="font-medium text-foreground">{r.fileName}</p>
              <p className="text-muted">
                {r.merchant ?? "—"}
                {r.amount != null ? ` · $${r.amount.toFixed(0)}` : ""}
                {r.authorizationId ? ` · auth ${r.authorizationId}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-dim">No receipts yet.</p>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled || pending || !fileName.trim()) return;
          const formData = new FormData(e.currentTarget);
          startTransition(async () => {
            await uploadReceiptAction(taskId, formData);
            setFileName("");
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor="rcpt-name">File name</Label>
          <Input
            id="rcpt-name"
            name="fileName"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="hotel-receipt.pdf"
            disabled={disabled || pending}
            required
          />
        </div>
        <div>
          <Label htmlFor="rcpt-auth">Authorization</Label>
          <select
            id="rcpt-auth"
            name="authorizationId"
            value={authId}
            onChange={(e) => setAuthId(e.target.value)}
            disabled={disabled || pending || authorizations.length === 0}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {authorizations.length === 0 ? (
              <option value="">No authorizations</option>
            ) : (
              authorizations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · ${a.amount.toFixed(0)} · {a.merchant}
                </option>
              ))
            )}
          </select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || pending || authorizations.length === 0}
          loading={pending}
        >
          Upload receipt
        </Button>
      </form>
    </section>
  );
}
