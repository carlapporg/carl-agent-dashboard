import type { PaymentTransactionRow } from "@/lib/api/payments-overview";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function filterTransactionsByDate(
  rows: PaymentTransactionRow[],
  from: string | null,
  to: string | null,
): PaymentTransactionRow[] {
  if (!from && !to) return rows;

  return rows.filter((row) => {
    const date = new Date(row.at);
    if (Number.isNaN(date.getTime())) return false;
    if (from) {
      const start = new Date(`${from}T00:00:00`);
      if (date < start) return false;
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999`);
      if (date > end) return false;
    }
    return true;
  });
}

export function downloadTransactionsCsv(rows: PaymentTransactionRow[]): void {
  const headers = [
    "TXN ID",
    "Customer",
    "Amount",
    "Currency",
    "Payment Method",
    "Status",
    "Date (ISO)",
  ];

  const lines = rows.map((row) =>
    [
      row.txnId,
      row.customer,
      row.amount.toFixed(2),
      row.currency,
      row.method,
      row.status,
      row.at,
    ]
      .map((cell) => escapeCsv(String(cell)))
      .join(","),
  );

  const csv = [headers.join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `carl-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
