import { requireUser } from "@/lib/auth";
import StudentShell from "./StudentShell";
import { loadDashboardData } from "./dashboard-data";

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;
  const dashboard = await loadDashboardData(supabase, user.id);

  return (
    <StudentShell
      studentName={dashboard.studentName}
      initialTab={tab}
      dashboard={dashboard}
    />
  );
}
