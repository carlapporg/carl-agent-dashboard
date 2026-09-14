import { ProfileSkeleton } from "@/components/feedback/skeleton";
import { PageShell } from "@/components/ui/page-shell";

export default function ProfileLoading() {
  return (
    <PageShell
      wide
      className="flex h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] flex-col overflow-hidden"
    >
      <ProfileSkeleton className="min-h-0 flex-1" />
    </PageShell>
  );
}
