import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import HRDashboardClient from "./_components/hr-dashboard-client";

export default async function HRDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const hasViewPerm = await hasPermission(session.user.id, "hr.payroll", "view");
  if (!hasViewPerm) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to view the HR dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">HR & Payroll Overview</h1>
        <p className="text-muted-foreground">Executive reporting dashboard and key performance indicators.</p>
      </div>
      <HRDashboardClient />
    </div>
  );
}
