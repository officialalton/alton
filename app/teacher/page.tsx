import { requireUser } from "@/lib/auth";
import { loadTeacherDashboard } from "./dashboard-data";
import TeacherShell from "./TeacherShell";

export default async function TeacherHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;

  const dashboard = await loadTeacherDashboard(supabase, user.id);

  return <TeacherShell initialTab={tab} dashboard={dashboard} />;
}
