import { MessagesSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";

export default function MessagesLoading() {
  return (
    <PageShell wide className="max-w-none">
      <MessagesSkeleton />
    </PageShell>
  );
}
