import {
  requestApprovalAction,
  uploadReceiptAction,
} from "@/features/tasks/actions/task-actions";
import { MarkPaidForm } from "@/features/payments/components/mark-paid-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  PaymentAuthorization,
  Receipt,
  VirtualCardSummary,
} from "@/types/payment";

type PaymentsPanelProps = {
  taskId: string;
  authorizations: PaymentAuthorization[];
  card: VirtualCardSummary | null;
  receipts: Receipt[];
};

export function PaymentsPanel({
  taskId,
  authorizations,
  card,
  receipts,
}: PaymentsPanelProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-foreground">
          Payment authorizations
        </h2>
        <p className="mt-1 text-sm text-muted">
          Carl tracks approved amounts separately from card networks. Over-limit
          charges should be declined.
        </p>
        <ul className="mt-4 space-y-3">
          {authorizations.length === 0 ? (
            <li className="text-sm text-muted">No authorizations yet.</li>
          ) : (
            authorizations.map((auth) => (
              <li
                key={auth.id}
                className="rounded-xl border border-border bg-surface-elevated p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    ${auth.amount.toFixed(0)} · {auth.merchant}
                  </p>
                  <Badge
                    variant={
                      auth.status === "approved"
                        ? "success"
                        : auth.status === "pending"
                          ? "warning"
                          : auth.status === "spent"
                            ? "accent"
                            : "muted"
                    }
                  >
                    {auth.status}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Remaining</dt>
                    <dd className="text-foreground-soft">
                      ${auth.remaining.toFixed(0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Category</dt>
                    <dd className="text-foreground-soft">
                      {auth.merchantCategory ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Approved by</dt>
                    <dd className="text-foreground-soft">
                      {auth.approvedBy ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Approved at</dt>
                    <dd className="text-foreground-soft">
                      {auth.approvedAt
                        ? new Date(auth.approvedAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-foreground">Request approval</h2>
        <form
          action={requestApprovalAction.bind(null, taskId)}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="1"
              step="1"
              placeholder="1200"
              required
            />
          </div>
          <div>
            <Label htmlFor="merchant">Merchant</Label>
            <Input
              id="merchant"
              name="merchant"
              placeholder="Hotel name"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="merchantCategory">Category</Label>
            <Input
              id="merchantCategory"
              name="merchantCategory"
              placeholder="Hotels"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Request customer approval</Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-foreground">Virtual card</h2>
        {card ? (
          <div className="mt-4 rounded-xl border border-border bg-surface-elevated p-4">
            <p className="text-base text-foreground">
              {card.network.toUpperCase()} ···· {card.last4}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Limit</dt>
                <dd className="text-foreground-soft">
                  ${card.spendingLimit.toFixed(0)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Remaining</dt>
                <dd className="text-foreground-soft">
                  ${card.remaining.toFixed(0)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="capitalize text-foreground-soft">{card.status}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-dim">
              Provider-agnostic summary. Real card numbers never appear here.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No card issued for this task yet.
          </p>
        )}

        <MarkPaidForm taskId={taskId} />
        <p className="mt-2 text-xs text-muted-dim">
          If charge exceeds remaining approval, the stub will reject it.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-foreground">Receipts</h2>
        <ul className="mt-3 space-y-2">
          {receipts.length === 0 ? (
            <li className="text-sm text-muted">No receipts uploaded.</li>
          ) : (
            receipts.map((receipt) => (
              <li
                key={receipt.id}
                className="rounded-xl border border-border px-3 py-2.5 text-sm"
              >
                <p className="text-foreground-soft">{receipt.fileName}</p>
                <p className="text-xs text-muted-dim">
                  {receipt.merchant ?? "Merchant TBD"}
                  {receipt.amount != null
                    ? ` · $${receipt.amount.toFixed(0)}`
                    : ""}
                  {" · "}
                  {new Date(receipt.uploadedAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
        <form
          action={uploadReceiptAction.bind(null, taskId)}
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <div className="sm:col-span-2">
            <Label htmlFor="fileName">File name</Label>
            <Input
              id="fileName"
              name="fileName"
              placeholder="hotel-receipt.pdf"
              required
            />
          </div>
          <div>
            <Label htmlFor="receiptAmount">Amount</Label>
            <Input
              id="receiptAmount"
              name="amount"
              type="number"
              min="0"
              step="1"
              placeholder="1180"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="receiptMerchant">Merchant</Label>
            <Input id="receiptMerchant" name="merchant" placeholder="East Hotel" />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" fullWidth>
              Upload stub
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
