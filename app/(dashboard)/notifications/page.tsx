import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";

export default function NotificationsPage() {
  redirect(`${ROUTES.history}?tab=notifications`);
}
