import { requireUser } from "@/lib/auth";
import StudentShell from "./StudentShell";
import { loadDashboardData } from "./dashboard-data";
import { loadVocabWords } from "@/app/session/[id]/vocab-data";
import { loadProblemLog } from "@/app/session/[id]/problemlog-data";

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;
  const dashboard = await loadDashboardData(supabase, user.id);
  const vocabWords = await loadVocabWords(supabase, user.id);
  const problemLog = await loadProblemLog(supabase, user.id);

  return (
    <StudentShell
      studentName={dashboard.studentName}
      initialTab={tab}
      dashboard={dashboard}
      vocabWords={vocabWords}
      problemLog={problemLog}
    />
  );
}
