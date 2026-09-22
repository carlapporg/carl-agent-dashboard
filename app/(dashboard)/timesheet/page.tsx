import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { CalendarView } from "@/features/calendar/components/calendar-view";

export const metadata: Metadata = {
  title: "Timesheet",
};

export default function TimesheetPage() {
  return (
    <PageShell wide>
      <CalendarView />
    </PageShell>
  );
}
