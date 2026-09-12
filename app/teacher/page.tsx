import { requireUser } from "@/lib/auth";
import { loadTeacherDashboard } from "./dashboard-data";
import { loadRoster } from "./roster-data";
import { loadMySubjects } from "./mysubjects-data";
import { loadTeacherAssignments } from "./assignments-data";
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

  // 2026-09-11(제품 오너 UAT — 첫 진입 지연 재지적) — 지난 라운드는
  // loadAllStudentCurricula()를 "학생 수만큼 개별 쿼리"에서 "고정 쿼리
  // 수"로 바꿨을 뿐, 여전히 담당 학생 "전체"의 커리큘럼 상세(단원별
  // 제목·메모·코멘트·세션 일정)를 이 페이지 로드 시점에 매번 다 읽어오는
  // 구조였다 — 그 상세는 "학생별" 목록에서 실제로 과목 하나를 열 때만
  // 필요하다. 이제 이 페이지는 "학생별" 목록에 필요한 요약(roster,
  // currentSession/totalSessions 카운트)만 내려주고, 커리큘럼 상세·메모·
  // 리뷰·학생 피드백은 CurriculumTab이 그 화면을 실제로 열 때
  // legacy-curriculum-actions.ts로 온디맨드 조회한다(같은 이유로
  // reviewedSessionIds도 제거 — TeacherShell 어디에서도 실제로 쓰이지
  // 않던 죽은 prop이었다).
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

  return (
    <TeacherShell
      initialTab={tab}
      dashboard={dashboard}
      roster={roster}
      mySubjects={mySubjects}
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
