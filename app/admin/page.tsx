import { requireUser } from "@/lib/auth";
import { loadAdminDashboard } from "./dashboard-data";
import AdminShell from "./AdminShell";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;

  const dashboard = await loadAdminDashboard(supabase, user.id);

  return <AdminShell initialTab={tab} dashboard={dashboard} />;
}
