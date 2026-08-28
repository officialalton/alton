import { requireUser } from "@/lib/auth";
import { loadTeacherDashboard } from "./dashboard-data";
import { loadRoster } from "./roster-data";
import { loadMySubjects } from "./mysubjects-data";
import { loadAllStudentCurricula } from "./curriculum-data";
import { loadReviewedSessionIds } from "./review-status-data";
import { loadMemos } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedback } from "@/app/student/review-data";
import TeacherShell from "./TeacherShell";

export default async function TeacherHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;

  const dashboard = await loadTeacherDashboard(supabase, user.id);
  const roster = await loadRoster(supabase, user.id);
  const mySubjects = await loadMySubjects(supabase, user.id);
  const curricula = await loadAllStudentCurricula(
    supabase,
    roster.map((r) => ({ studentId: r.studentId, studentName: r.studentName }))
  );

  const memosByEnrollment: Record<string, Awaited<ReturnType<typeof loadMemos>>> = {};
  for (const c of curricula) {
    memosByEnrollment[c.enrollmentId] = await loadMemos(supabase, c.enrollmentId);
  }

  const allSessionIds = curricula
    .flatMap((c) => c.units.map((u) => u.sessionId))
    .filter((id): id is string => !!id);
  const reviews = await loadReviews(supabase, allSessionIds);

  const studentFeedback: Record<string, Awaited<ReturnType<typeof loadStudentFeedback>>[string]> = {};
  const studentIds = Array.from(new Set(curricula.map((c) => c.studentId)));
  for (const studentId of studentIds) {
    const sessionIdsForStudent = curricula
      .filter((c) => c.studentId === studentId)
      .flatMap((c) => c.units.map((u) => u.sessionId))
      .filter((id): id is string => !!id);
    const feedback = await loadStudentFeedback(supabase, studentId, sessionIdsForStudent);
    Object.assign(studentFeedback, feedback);
  }

  const reviewedSessionIds = await loadReviewedSessionIds(
    supabase,
    dashboard.past.map((l) => l.sessionId)
  );

  return (
    <TeacherShell
      initialTab={tab}
      dashboard={dashboard}
      roster={roster}
      mySubjects={mySubjects}
      curricula={curricula}
      memosByEnrollment={memosByEnrollment}
      reviews={reviews}
      studentFeedback={studentFeedback}
      reviewedSessionIds={reviewedSessionIds}
    />
  );
}
