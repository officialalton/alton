import type { SupabaseClient } from "@supabase/supabase-js";

// R6 11/N — 선생님이 본인의 정규수업(v3 sessions/reservations, Calendar/Meet 연동 대상)을
// 조회하는 화면의 데이터 로더. `app/teacher/dashboard-data.ts`(레거시 `legacy_sessions`
// 기반 세션뷰/과제 기능)와는 완전히 별개 — 그 파일은 R6 자체 예약과 무관하다.

export type TeacherLessonScheduleItem = {
  reservationId: string;
  sessionId: string;
  studentName: string;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  googleMeetLink: string | null;
  googleSyncStatus: string;
  externalChangeStatus: string;
  isTrial: boolean;
  smartNotesDriveFileId: string | null;
  // 2026-09-17(제품 오너 피드백) — 리뷰 확정 여부는 체험/정규 모두 동일하게
  // lesson_reviews(trial_session_id 또는 regular_session_id)에서 온다.
  // finalStatus/reviewStatus는 "예정/지난" 판정(isPastLesson)과 "수업 리뷰 작성"
  // 버튼 노출 조건에 쓰인다.
  finalStatus: string;
  subjectEnrollmentId: string;
  reviewStatus: "none" | "draft" | "final";
};

// M4 UAT #5 — 완료된 체험 수업은 리뷰를 확정하기 전까지 "예정된 수업" 쪽에
// 남아있다가, 확정해야 "지난 수업" 목록으로 넘어간다(정규 수업은 R9 범위 밖 —
// 기존 날짜/상태 기준 그대로 유지). 원래 TeacherLessonScheduleTab.tsx에만
// 있던 로컬 함수였으나, 2026-09-10(P0-4) 교사 홈 대시보드도 정확히 같은
// "예정/지난" 판정을 써야 해서 이 모듈(v3 조회 정본)로 옮겨 공유한다 — 화면마다
// 판정 기준이 갈리는 것을 막기 위함.
export function isPastLesson(lesson: TeacherLessonScheduleItem, nowMs: number): boolean {
  const ended = new Date(lesson.endsAt).getTime() < nowMs;
  // 2026-09-17(실사용 중 발견) — 두 가지를 한 번에 고친다.
  // (1) 시간 경과만 보고 판정해, 예약 시각이 아직 미래인데 final_status가
  //     이미 종결(completed 등)된 세션이 "예정 수업"에 계속 남아 '수업
  //     준비'/'Meet 입장'이 활성화돼 있었다 — app/student/lesson-booking-data.ts
  //     의 isPastSession()과 동일 기준(시간 경과 OR 최종판정)으로 통일한다.
  // (2) 체험 수업은 리뷰가 확정(final)돼야만 지난 수업으로 넘어가던 예전
  //     정책은 이미 2026-09-11 학생/학부모 쪽에서 폐기됐다("완료된 체험
  //     수업이 리뷰만 안 끝났다는 이유로 예정 수업에 계속 남는" 결함이었기
  //     때문 — 제품 오너 지시). 교사 쪽만 그 정정이 누락돼 있었다. 리뷰
  //     미확정 여부는 이제 화면에서 "리뷰 작성 필요" 배지로만 표시하고,
  //     예정/지난 분류 자체에는 더 이상 쓰지 않는다.
  const finalized = lesson.finalStatus !== "scheduled" && lesson.finalStatus !== "live";
  return ended || finalized;
}

export async function loadTeacherLessonSchedule(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherLessonScheduleItem[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, teacher_id, final_status, subject_enrollment_id, session_smart_notes(drive_file_id), lesson_type:lesson_types(code), reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at, status, google_meet_link, google_sync_status, external_change_status), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name), child:profiles!subject_enrollments_child_id_fkey(name))"
    )
    .eq("teacher_id", teacherId)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);

  // 2026-09-17(제품 오너 피드백) — 체험/정규 모두 리뷰 상태를 조회한다.
  // lesson_reviews는 세션당 trial_session_id 또는 regular_session_id 중
  // 정확히 하나만 채우므로 두 컬럼 다 대상으로 조회해야 정규 수업 리뷰 상태도
  // 잡힌다(체험만 걸면 정규 리뷰가 항상 "none"으로 보였다).
  const allSessionIds = (data ?? []).map((row) => row.id as string);
  const { data: reviews } = allSessionIds.length
    ? await supabase
        .from("lesson_reviews")
        .select("trial_session_id, regular_session_id, status")
        .or(`trial_session_id.in.(${allSessionIds.join(",")}),regular_session_id.in.(${allSessionIds.join(",")})`)
    : { data: [] as { trial_session_id: string | null; regular_session_id: string | null; status: string }[] };
  const reviewStatusBySession = new Map(
    (reviews ?? [])
      .map((r) => [r.trial_session_id ?? r.regular_session_id, r.status] as const)
      .filter((entry): entry is [string, string] => entry[0] !== null)
  );

  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }

  return (data ?? [])
    .map((row): TeacherLessonScheduleItem | null => {
      const reservation = one(row.reservation as unknown) as {
        id?: string;
        starts_at?: string;
        ends_at?: string;
        status?: string;
        google_meet_link?: string | null;
        google_sync_status?: string;
        external_change_status?: string;
      } | null;
      const subjectEnrollment = one(row.subject_enrollment as unknown) as { subject?: unknown; child?: unknown } | null;
      const subject = one(subjectEnrollment?.subject as unknown) as { name?: string } | null;
      const child = one(subjectEnrollment?.child as unknown) as { name?: string } | null;
      const lessonType = one(row.lesson_type as unknown) as { code?: string } | null;
      const smartNotes = one(row.session_smart_notes as unknown) as { drive_file_id?: string } | null;
      if (!reservation?.id || reservation.status !== "confirmed") return null;
      return {
        reservationId: reservation.id,
        sessionId: row.id as string,
        studentName: child?.name ?? "",
        subjectName: subject?.name ?? "",
        startsAt: reservation.starts_at as string,
        endsAt: reservation.ends_at as string,
        status: reservation.status,
        googleMeetLink: reservation.google_meet_link ?? null,
        googleSyncStatus: reservation.google_sync_status ?? "pending",
        externalChangeStatus: reservation.external_change_status ?? "none",
        isTrial: lessonType?.code === "trial",
        smartNotesDriveFileId: smartNotes?.drive_file_id ?? null,
        finalStatus: row.final_status as string,
        subjectEnrollmentId: row.subject_enrollment_id as string,
        reviewStatus: (reviewStatusBySession.get(row.id as string) as "draft" | "final" | undefined) ?? "none",
      };
    })
    .filter((item): item is TeacherLessonScheduleItem => item !== null)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
