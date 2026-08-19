import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditProfileView } from "@/features/profile/components/edit-profile-view";
import { agentsApi } from "@/lib/api/agents";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Edit profile",
};

export default async function EditProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect(ROUTES.login);
  }

  let user = session.user;
  try {
    user = await agentsApi.me();
  } catch {
    // Fall back to session snapshot.
  }

  return <EditProfileView user={user} />;
}
