import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileView } from "@/features/profile/components/profile-view";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect(ROUTES.login);
  }

  return <ProfileView initialUser={session.user} />;
}
