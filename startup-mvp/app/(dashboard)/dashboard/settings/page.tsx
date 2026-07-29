import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SettingsPageClient from "./settings-page-client-admin";

export default async function SettingsPage() {
  const session = await auth();

  // Check if user has valid session
  if (!session?.user?.id || !session?.user?.email) {
    redirect("/login");
  }

  // Only admin users can access settings
  const userRole = session.user.role?.toLowerCase();
  if (userRole !== "admin") {
    redirect("/dashboard");
  }

  return <SettingsPageClient />;
}
