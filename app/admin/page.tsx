import { requireUser } from "@/lib/auth";
import { loadAdminDashboard } from "./dashboard-data";
import { loadSubjectCatalog } from "./subject-data";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";
import AdminShell from "./AdminShell";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;

  const dashboard = await loadAdminDashboard(supabase, user.id);
  const subjects = await loadSubjectCatalog(supabase);
  const docs = await loadAllCurriculumDocs(supabase);

  return (
    <AdminShell initialTab={tab} dashboard={dashboard} subjects={subjects} docs={docs} />
  );
}
