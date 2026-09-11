import { requireUser } from "@/lib/auth";
import { loadTeacherDashboard } from "./dashboard-data";
import { loadRoster } from "./roster-data";
import { loadMySubjects } from "./mysubjects-data";
import { loadAllStudentCurricula } from "./curriculum-data";
import { loadReviewedSessionIds } from "./review-status-data";
import { loadTeacherAssignments } from "./assignments-data";
import { loadMemosByEnrollmentIds } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedbackForStudents } from "@/app/student/review-data";
import TeacherShell from "./TeacherShell";
import { listMyAvailabilityRules, listTeacherAvailabilityExceptions } from "./availability-actions";
import { listMyLessonSchedule } from "./lesson-schedule-actions";
import { resolveUserTimezone } from "@/lib/timezone";
import { loadTeacherMaterialsLibrary } from "./materials-data";

export default async function TeacherHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;

  // 2026-09-10(P0-4) — 교사 홈 대시보드가 "수업" 탭과 같은 v3 예약을 보게
  // 하려면 loadTeacherLessonSchedule() 결과(+이 교사의 timezone)가 먼저 있어야
  // 한다. 학생 홈(2026-09-09 정정)과 동일하게 dashboard만 그 결과에 체이닝하고
  // 나머지 로더는 그대로 병렬 유지한다.
  const lessonSchedulePromise = listMyLessonSchedule();
  const teacherProfilePromise = supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const dashboardPromise = Promise.all([lessonSchedulePromise, teacherProfilePromise]).then(
    ([lessonSchedule, { data: teacherProfile }]) => {
      const timezone = resolveUserTimezone({
        profileTimezone: (teacherProfile?.timezone as string) ?? null,
        householdDefaultTimezone: null,
      });
      return loadTeacherDashboard(supabase, user.id, lessonSchedule, timezone);
    }
  );

  // 2026-09-11(제품 오너 실사용 보고 — "학생별 커리큘럼" 진입이 매우 느림,
  // 실측 결과 Gateway Timeout까지 발생) — materialsSubjects는 roster 등
  // 앞 단계 결과에 의존하지 않는데도 별도 순차 단계로 분리돼 있었다 — 첫
  // Promise.all에 합쳐 왕복 1회를 없앤다.
  const [
    dashboard,
    roster,
    mySubjects,
    { current: currentAssignments, past: pastAssignments },
    availabilityRules,
    availabilityExceptions,
    lessonSchedule,
    { data: teacherProfile },
    materialsSubjects,
  ] = await Promise.all([
    dashboardPromise,
    loadRoster(supabase, user.id),
    loadMySubjects(supabase, user.id),
    loadTeacherAssignments(supabase, user.id),
    listMyAvailabilityRules(),
    listTeacherAvailabilityExceptions(),
    lessonSchedulePromise,
    teacherProfilePromise,
    loadTeacherMaterialsLibrary(supabase, user.id),
  ]);
  const availabilityTimezone = resolveUserTimezone({
    profileTimezone: (teacherProfile?.timezone as string) ?? null,
    householdDefaultTimezone: null,
  });

  // 2026-09-11(같은 라운드) — loadAllStudentCurricula()는 이제 담당 학생
  // 전체를 쿼리 4회로 배치 조회한다(기존: 학생 수만큼 동시 쿼리 — 담당
  // 학생이 많은 실제 계정에서 DB 커넥션 과부하로 Gateway Timeout까지
  // 발생했다).
  const curricula = await loadAllStudentCurricula(
    supabase,
    roster.map((r) => ({ studentId: r.studentId, studentName: r.studentName }))
  );

  const allSessionIds = curricula
    .flatMap((c) => c.units.map((u) => u.sessionId))
    .filter((id): id is string => !!id);
  const studentIds = Array.from(new Set(curricula.map((c) => c.studentId)));
  const enrollmentIds = curricula.map((c) => c.enrollmentId);

  // 2026-09-11(같은 라운드) — memos/feedback도 enrollment·학생 수만큼
  // 개별 쿼리하던 것을 각 쿼리 1회 배치 조회로 교체했다(위와 동일한 이유).
  const [memosByEnrollment, reviews, studentFeedback, reviewedSessionIds] = await Promise.all([
    loadMemosByEnrollmentIds(supabase, enrollmentIds),
    loadReviews(supabase, allSessionIds),
    loadStudentFeedbackForStudents(supabase, studentIds, allSessionIds),
    loadReviewedSessionIds(
      supabase,
      dashboard.past.map((l) => l.sessionId)
    ),
  ]);

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
      materialsSubjects={materialsSubjects}
    />
  );
}
