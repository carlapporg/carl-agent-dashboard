import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { WorkDiaryView } from "@/features/work-diary/components/work-diary-view";

export const metadata: Metadata = {
  title: "Work Diary",
};

export default function WorkDiaryPage() {
  return (
    <PageShell wide>
      <WorkDiaryView />
    </PageShell>
  );
}
