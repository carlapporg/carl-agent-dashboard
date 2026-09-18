import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { CalendarView } from "@/features/calendar/components/calendar-view";

export const metadata: Metadata = {
  title: "Calendar",
};

export default function CalendarPage() {
  return (
    <PageShell wide>
      <CalendarView />
    </PageShell>
  );
}
