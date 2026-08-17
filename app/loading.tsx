import { PageSkeleton } from "@/components/feedback/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 items-start justify-center px-4 py-10">
      <PageSkeleton />
    </div>
  );
}
