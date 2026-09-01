import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";

type PaymentsPageProps = {
  params: Promise<{ taskId: string }>;
};

export const metadata: Metadata = {
  title: "Payments",
};

/** Receipt and payment proof live in the task workspace — not a separate Nest ledger page yet. */
export default async function TaskPaymentsPage({ params }: PaymentsPageProps) {
  const { taskId } = await params;
  redirect(ROUTES.taskPanel(taskId, "receipt"));
}
