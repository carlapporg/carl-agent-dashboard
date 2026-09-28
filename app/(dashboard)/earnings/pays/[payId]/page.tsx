import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { PayDetailView } from "@/features/earnings/components/pay-detail-view";

export const metadata: Metadata = {
  title: "Pay",
};

export default async function PayDetailPage({
  params,
}: {
  params: Promise<{ payId: string }>;
}) {
  const { payId } = await params;
  return (
    <PageShell wide>
      <PayDetailView payId={payId} />
    </PageShell>
  );
}
