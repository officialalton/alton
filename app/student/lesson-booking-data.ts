import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStudentSubjectEnrollments } from "./enrollment-data";
import { resolveUserTimezone } from "@/lib/timezone";

// R6 6/N — 정규수업 예약 화면 데이터 로더(읽기 전용). subject_enrollments/
// teacher_assignments 조회는 기존 R5 로더(loadStudentSubjectEnrollments)를 그대로
// 재사용한다(RLS가 이미 본인/보호자/배정된 선생님/관리자로 범위를 제한).

export type BookableSubjectEnrollment = {
  subjectEnrollmentId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  lessonTypeId: string;
  lessonDurationMinutes: number;
  isTrial: boolean;
};

export type UpcomingBooking = {
  reservationId: string;
  sessionId: string;
  // 선택 필드로 둔 이유: 기존 테스트 픽스처(여러 파일)가 이 필드 없이
  // UpcomingBooking을 직접 만들어 쓰고 있어, 실제 로더(loadLessonBookingData)
  // 는 항상 채우되 타입은 하위 호환을 위해 optional로 둔다.
  subjectEnrollmentId?: string;
  subjectName: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  googleMeetLink: string | null;
  googleSyncStatus: string;
};

export type PastSessionForReport = {
  sessionId: string;
  subjectName: string;
  teacherName: string;
  startsAt: string;
};

// v3 재매칭 후 예약 결함 수정(2026-09-11) — 같은 과목에 이미 종료(terminated)·
// 완료(completed)된 수강 이력이 있는 학생은 "재매칭"이다. 재매칭 직후 새
// subject_enrollment는 항상 'planned'로 시작하는데, 그동안 이 로더가 status만
// 보고 무조건 "체험" 후보로 취급해(isTrial = status !== 'active') 이미 정규
// 계약이 있는 가족에게도 새 체험 슬롯을 내줄 뻔했다(재매칭만으로 체험 기회가
// 새로 생기면 안 된다는 정책 위반). 계약/수업권이 아직 활성화되지 않은
// 재매칭 건은 체험 후보 목록에서 빼고, 대신 "정규 계약 대기" 안내 대상으로
// 분리한다 — 캘린더를 띄우기 전에 활성화 대기 상태를 바로 알려준다.
export type PendingActivationSubject = {
  subjectEnrollmentId: string;
  subjectName: string;
  teacherName: string;
};

export type LessonBookingData = {
  bookableEnrollments: BookableSubjectEnrollment[];
  pendingActivationSubjects?: PendingActivationSubject[];
  upcomingBookings: UpcomingBooking[];
  pastSessionsForReport: PastSessionForReport[];
  timezone: string;
};

export async function loadLessonBookingData(
  supabase: SupabaseClient,
  childId: string
): Promise<LessonBookingData> {
  const enrollments = await loadStudentSubjectEnrollments(supabase, childId);

  const { data: lessonTypeRows } = await supabase
    .from("lesson_types")
    .select("id, code, duration_minutes")
    .in("code", ["regular", "trial"]);
  const regularType = (lessonTypeRows ?? []).find((t) => t.code === "regular") as
    | { id: string; duration_minutes: number }
    | undefined;
  const trialType = (lessonTypeRows ?? []).find((t) => t.code === "trial") as
    | { id: string; duration_minutes: number }
    | undefined;

  // 같은 과목으로 이미 종료·완료된 수강 이력이 있으면(재매칭) 새 'planned'
  // 건을 체험 후보로 보여주지 않는다 — subjectId 기준, 이 enrollment 자신은
  // 제외.
  const subjectIdsWithPriorEnrollment = new Set(
    enrollments
      .filter((e) => e.status === "terminated" || e.status === "completed")
      .map((e) => e.subjectId)
  );

  // 2026-09-09(UAT 지적): 체험수업권 지급 여부로 후보 목록 자체를 숨기면,
  // "선생님 배정이 필요합니다" 문구가 실제로는 "체험수업권 지급 대기 중"인
  // 경우까지 오인시킨다. 수업권 잔여량 검증은 어차피 예약 확정 시
  // hold_entitlement()가 최종 강제하므로("사용 가능한 수업권이 없습니다"),
  // 여기서는 선생님 배정 여부만으로 후보를 보여주고 실제 부족 여부는 예약
  // 시도 시점의 에러로 안내한다.
  const bookableEnrollments: BookableSubjectEnrollment[] = [];
  const pendingActivationSubjects: PendingActivationSubject[] = [];
  for (const e of enrollments) {
    if (!e.currentTeacher) continue;
    if (e.status === "active" && regularType) {
      bookableEnrollments.push({
        subjectEnrollmentId: e.id,
        subjectName: e.subjectName,
        teacherId: e.currentTeacher.teacherId,
        teacherName: e.currentTeacher.teacherName,
        lessonTypeId: regularType.id,
        lessonDurationMinutes: regularType.duration_minutes,
        isTrial: false,
      });
    } else if (e.status === "planned") {
      if (subjectIdsWithPriorEnrollment.has(e.subjectId)) {
        pendingActivationSubjects.push({
          subjectEnrollmentId: e.id,
          subjectName: e.subjectName,
          teacherName: e.currentTeacher.teacherName,
        });
      } else if (trialType) {
        bookableEnrollments.push({
          subjectEnrollmentId: e.id,
          subjectName: e.subjectName,
          teacherId: e.currentTeacher.teacherId,
          teacherName: e.currentTeacher.teacherName,
          lessonTypeId: trialType.id,
          lessonDurationMinutes: trialType.duration_minutes,
          isTrial: true,
        });
      }
    }
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  let upcomingBookings: UpcomingBooking[] = [];
  let pastSessionsForReport: PastSessionForReport[] = [];
  if (enrollmentIds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select(
        "id, subject_enrollment_id, final_status, lesson_type:lesson_types(code), reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at, status, google_meet_link, google_sync_status), teacher:profiles!sessions_teacher_id_fkey(name), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name))"
      )
      .in("subject_enrollment_id", enrollmentIds)
      .order("created_at", { ascending: true });

    type BookingRow = {
      reservationId: string | null;
      sessionId: string;
      subjectEnrollmentId: string;
      subjectName: string;
      teacherName: string;
      startsAt: string;
      endsAt: string;
      status: string;
      googleMeetLink: string | null;
      googleSyncStatus: string;
      finalStatus: string;
      isTrial: boolean;
    };

    const rows = (sessions ?? [])
      .map((s): BookingRow | null => {
        const reservation = Array.isArray(s.reservation) ? s.reservation[0] : s.reservation;
        const teacher = Array.isArray(s.teacher) ? s.teacher[0] : s.teacher;
        const subjectEnrollment = Array.isArray(s.subject_enrollment) ? s.subject_enrollment[0] : s.subject_enrollment;
        const subject = subjectEnrollment ? (Array.isArray(subjectEnrollment.subject) ? subjectEnrollment.subject[0] : subjectEnrollment.subject) : null;
        const lessonType = Array.isArray(s.lesson_type) ? s.lesson_type[0] : s.lesson_type;
        if (!reservation) return null;
        return {
          reservationId: reservation.id as string,
          sessionId: s.id as string,
          subjectEnrollmentId: s.subject_enrollment_id as string,
          subjectName: (subject as { name?: string } | null)?.name ?? "",
          teacherName: (teacher as { name?: string } | null)?.name ?? "",
          startsAt: reservation.starts_at as string,
          endsAt: reservation.ends_at as string,
          status: reservation.status as string,
          googleMeetLink: (reservation.google_meet_link as string | null) ?? null,
          googleSyncStatus: reservation.google_sync_status as string,
          finalStatus: s.final_status as string,
          isTrial: (lessonType as { code?: string } | null)?.code === "trial",
        };
      })
      .filter((r): r is BookingRow => r !== null);

    // 체험 수업의 확정 리뷰 상태 — 선생님 포털(app/teacher/lesson-schedule-data.ts,
    // TeacherLessonScheduleTab.isPastLesson)과 동일하게, 체험 수업은 리뷰가 확정되기
    // 전까지는 "지난 수업"으로 넘기지 않는다. 같은 수업이 선생님 쪽은 "예정"인데 학생
    // 쪽은 "지난"으로 보이는 혼란을 막기 위함(2026-09-06 제품 오너 지적).
    const trialSessionIds = rows.filter((r) => r.isTrial).map((r) => r.sessionId);
    const { data: reviews } = trialSessionIds.length
      ? await supabase.from("lesson_reviews").select("trial_session_id, status").in("trial_session_id", trialSessionIds)
      : { data: [] as { trial_session_id: string; status: string }[] };
    const reviewStatusBySession = new Map((reviews ?? []).map((r) => [r.trial_session_id, r.status]));

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

    // 예정/지난 판정(2026-09-06 정리) — 기존에는 순수 startsAt > now 여부만으로
    // 판정해 sessions.status/finalize_lesson_session() 결과와 무관했다(선생님이
    // 조기 종료 처리해도 시작 시각이 안 지났으면 학생 쪽은 계속 "예정 수업"에 남는
    // 어색함이 있었음). 이제 (1) 시작 시각이 지났거나 (2) 세션이 이미 최종판정됐으면
    // (final_status가 scheduled/live가 아니면) "지난 수업"으로 분류한다 — 단, 체험
    // 수업은 선생님 포털과 동일하게 리뷰 확정 전까지는 예정 쪽에 남긴다.
    function isPastSession(r: BookingRow): boolean {
      const timeEnded = new Date(r.startsAt) <= now;
      const finalized = r.finalStatus !== "scheduled" && r.finalStatus !== "live";
      if (!timeEnded && !finalized) return false;
      // v3 재매칭 후 예약 결함 수정(2026-09-11) — 체험 수업이 "완료(completed)"로
      // 판정됐을 때만 리뷰 확정을 기다린다. 취소·노쇼 등 다른 최종 판정은 리뷰
      // 대상이 아니므로(선생님 포털도 동일 — 리뷰는 실제로 진행된 수업만 남긴다),
      // 리뷰 미확정을 이유로 "예정 수업"에 계속 묶어두면 안 된다. 예전에는 체험
      // 수업이면 finalStatus와 무관하게 무조건 리뷰 확정 전까지 예정으로
      // 남겨뒀다 — 이미 완료 판정된 체험 수업이 리뷰만 안 끝났다는 이유로 계속
      // "수업 시작" 버튼과 함께 예정 수업 목록에 남는 표시 결함의 원인이었다.
      if (r.isTrial && r.finalStatus === "completed" && reviewStatusBySession.get(r.sessionId) !== "final") {
        return false;
      }
      return true;
    }

    upcomingBookings = rows
      .filter((r) => r.status === "confirmed" && !isPastSession(r))
      .map((r) => ({
        reservationId: r.reservationId as string,
        sessionId: r.sessionId,
        subjectEnrollmentId: r.subjectEnrollmentId,
        subjectName: r.subjectName,
        teacherName: r.teacherName,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        googleMeetLink: r.googleMeetLink,
        googleSyncStatus: r.googleSyncStatus,
      }))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    // 지각·노쇼 신고 대상 — 최근 14일 이내 지난 수업으로 넘어간 세션(취소된 예약 제외,
    // 신고할 "일어난 수업"이 아니므로). 최종 판정·수업권 소진은 R7 범위 — 여기서는 신고
    // 대상 목록만 노출한다.
    pastSessionsForReport = rows
      .filter((r) => r.status === "confirmed" && isPastSession(r) && new Date(r.startsAt) >= fourteenDaysAgo)
      .map((r) => ({ sessionId: r.sessionId, subjectName: r.subjectName, teacherName: r.teacherName, startsAt: r.startsAt }))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", childId).maybeSingle();
  const { data: householdLink } = await supabase
    .from("household_members")
    .select("household:households(default_timezone)")
    .eq("profile_id", childId)
    .maybeSingle();
  const household = householdLink ? (Array.isArray(householdLink.household) ? householdLink.household[0] : householdLink.household) : null;

  return {
    bookableEnrollments,
    pendingActivationSubjects,
    upcomingBookings,
    pastSessionsForReport,
    timezone: resolveUserTimezone({
      profileTimezone: (profile?.timezone as string) ?? null,
      householdDefaultTimezone: (household as { default_timezone?: string } | null)?.default_timezone ?? null,
    }),
  };
}
