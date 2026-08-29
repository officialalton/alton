import { requireUser } from "@/lib/auth";
import { loadAdminDashboard } from "./dashboard-data";
import { loadSubjectCatalog } from "./subject-data";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";
import {
  loadParents,
  loadStudents,
  loadTeachers,
  loadStudentCreditHistory,
  loadTeacherQcWarnings,
} from "./users-data";
import { loadPendingConsults, loadFamilyContracts } from "./contracts-data";
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

  const parents = await loadParents(supabase);
  const students = await loadStudents(supabase);
  const teachers = await loadTeachers(supabase);
  const pendingConsults = await loadPendingConsults(supabase);
  const familyContracts = await loadFamilyContracts(supabase);

  const creditHistoryByStudent: Record<string, Awaited<ReturnType<typeof loadStudentCreditHistory>>> = {};
  for (const s of students) {
    creditHistoryByStudent[s.id] = await loadStudentCreditHistory(supabase, s.id);
  }

  const qcWarningsByTeacher: Record<string, Awaited<ReturnType<typeof loadTeacherQcWarnings>>> = {};
  for (const t of teachers) {
    qcWarningsByTeacher[t.id] = await loadTeacherQcWarnings(supabase, t.id);
  }

  return (
    <AdminShell
      initialTab={tab}
      dashboard={dashboard}
      subjects={subjects}
      docs={docs}
      parents={parents}
      students={students}
      teachers={teachers}
      creditHistoryByStudent={creditHistoryByStudent}
      qcWarningsByTeacher={qcWarningsByTeacher}
      pendingConsults={pendingConsults}
      familyContracts={familyContracts}
    />
  );
}
