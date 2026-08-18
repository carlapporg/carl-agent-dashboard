import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentsPanel } from "@/features/payments/components/payments-panel";
import { paymentsApi, receiptsApi } from "@/lib/api/payments";
import { tasksApi } from "@/lib/api/tasks";
import { ROUTES } from "@/lib/constants/routes";

type PaymentsPageProps = {
  params: Promise<{ taskId: string }>;
};

export const metadata: Metadata = {
  title: "Payments",
};

export default async function TaskPaymentsPage({ params }: PaymentsPageProps) {
  const { taskId } = await params;

  let task;
  try {
    task = await tasksApi.get(taskId);
  } catch {
    notFound();
  }

  const [authorizations, card, receipts] = await Promise.all([
    paymentsApi.list(taskId),
    paymentsApi.getCard(taskId),
    receiptsApi.list(taskId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={ROUTES.task(taskId)}
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        ← Back to task
      </Link>
      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Payments & receipts
        </h1>
        <p className="mt-2 text-base text-muted">
          Task #{task.number} · {task.title}
        </p>
      </header>
      <PaymentsPanel
        taskId={taskId}
        authorizations={authorizations}
        card={card}
        receipts={receipts}
      />
    </div>
  );
}
