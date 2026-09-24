import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";

type PaymentsPageProps = {
  params: Promise<{ taskId: string }>;
};

export const metadata: Metadata = {
  title: "Payments",
};

/** Booking payment + card reveal live on the task workspace payment panel. */
export default async function TaskPaymentsPage({ params }: PaymentsPageProps) {
  const { taskId } = await params;
  redirect(ROUTES.taskPanel(taskId, "payment"));
}
