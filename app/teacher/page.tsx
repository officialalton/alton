import { requireUser } from "@/lib/auth";
import { loadTeacherDashboard } from "./dashboard-data";
import { loadRoster } from "./roster-data";
import { loadMySubjects } from "./mysubjects-data";
import { loadAllStudentCurricula } from "./curriculum-data";
import { loadReviewedSessionIds } from "./review-status-data";
import { loadTeacherAssignments } from "./assignments-data";
import { loadMemos } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedback } from "@/app/student/review-data";
import TeacherShell from "./TeacherShell";
import { listMyAvailabilityRules, listTeacherAvailabilityExceptions } from "./availability-actions";
import { listMyLessonSchedule } from "./lesson-schedule-actions";
import { resolveUserTimezone } from "@/lib/timezone";

export default async function TeacherHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;

  const [
    dashboard,
    roster,
    mySubjects,
    { current: currentAssignments, past: pastAssignments },
    availabilityRules,
    availabilityExceptions,
    lessonSchedule,
    { data: teacherProfile },
  ] = await Promise.all([
    loadTeacherDashboard(supabase, user.id),
    loadRoster(supabase, user.id),
    loadMySubjects(supabase, user.id),
    loadTeacherAssignments(supabase, user.id),
    listMyAvailabilityRules(),
    listTeacherAvailabilityExceptions(),
    listMyLessonSchedule(),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  const availabilityTimezone = resolveUserTimezone({
    profileTimezone: (teacherProfile?.timezone as string) ?? null,
    householdDefaultTimezone: null,
  });

  const curricula = await loadAllStudentCurricula(
    supabase,
    roster.map((r) => ({ studentId: r.studentId, studentName: r.studentName }))
  );

  const allSessionIds = curricula
    .flatMap((c) => c.units.map((u) => u.sessionId))
    .filter((id): id is string => !!id);
  const studentIds = Array.from(new Set(curricula.map((c) => c.studentId)));

  const [memosEntries, reviews, studentFeedbackEntries, reviewedSessionIds] =
    await Promise.all([
      Promise.all(
        curricula.map(
          async (c) => [c.enrollmentId, await loadMemos(supabase, c.enrollmentId)] as const
        )
      ),
      loadReviews(supabase, allSessionIds),
      Promise.all(
        studentIds.map(async (studentId) => {
          const sessionIdsForStudent = curricula
            .filter((c) => c.studentId === studentId)
            .flatMap((c) => c.units.map((u) => u.sessionId))
            .filter((id): id is string => !!id);
          return loadStudentFeedback(supabase, studentId, sessionIdsForStudent);
        })
      ),
      loadReviewedSessionIds(
        supabase,
        dashboard.past.map((l) => l.sessionId)
      ),
    ]);

  const memosByEnrollment = Object.fromEntries(memosEntries) as Record<
    string,
    Awaited<ReturnType<typeof loadMemos>>
  >;
  const studentFeedback: Record<string, Awaited<ReturnType<typeof loadStudentFeedback>>[string]> = {};
  for (const feedback of studentFeedbackEntries) {
    Object.assign(studentFeedback, feedback);
  }

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
      currentAssignments={currentAssignments}
      pastAssignments={pastAssignments}
      availabilityRules={availabilityRules}
      availabilityExceptions={availabilityExceptions}
      availabilityTimezone={availabilityTimezone}
      lessonSchedule={lessonSchedule}
    />
  );
}
