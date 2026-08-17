import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? ROUTES.dashboard : ROUTES.login);
}
