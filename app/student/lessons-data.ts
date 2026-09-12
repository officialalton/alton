import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonBookingData } from "./lesson-booking-data";

export type LessonItem = {
  sessionId: string;
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  // v3 예약(sessions/reservations)에는 회차 개념이 없어 null일 수 있다
  // (2026-09-11 — "수업" 탭 예정 수업 목록이 legacy_sessions만 조회해 v3
  // 전용 배정 자녀의 예정 수업이 학부모/학생 "수업" 탭에서 누락되던 문제
  // 수정. app/student/dashboard-data.ts가 "홈" 탭에서 이미 쓰던 것과 동일한
  // 패턴).
  sessionNumber: number | null;
  unitTitle: string | null;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadLessons(
  supabase: SupabaseClient,
  studentId: string,
  // v3 예약 데이터 — 호출자가 이미 loadLessonBookingData()로 가져온 결과를
  // 그대로 넘긴다(같은 화면에서 두 번 조회하지 않기 위함). 넘기지 않으면
  // 레거시만으로 동작(하위 호환).
  lessonBooking?: LessonBookingData
): Promise<{ upcoming: LessonItem[]; past: LessonItem[] }> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, teacher_id, subject_id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const teacherIds = Array.from(
    new Set((enrollments ?? []).map((e) => e.teacher_id))
  );

  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from("profiles").select("id, name").in("id", teacherIds)
    : { data: [] as { id: string; name: string }[] };

  const enrollmentInfo = new Map(
    (enrollments ?? []).map((e) => [
      e.id,
      {
        subjectId: e.subject_id,
        subjectName: extractName(e.subject),
        teacherId: e.teacher_id,
      },
    ])
  );
  const teacherNameById = new Map(
    (teacherProfiles ?? []).map((t) => [t.id, t.name])
  );

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("legacy_sessions")
        .select(
          "id, enrollment_id, session_number, unit_title, status, scheduled_at, duration_minutes"
        )
        .in("enrollment_id", enrollmentIds)
    : { data: [] as never[] };

  const upcoming: LessonItem[] = [];
  const past: LessonItem[] = [];

  for (const s of sessions ?? []) {
    const info = enrollmentInfo.get(s.enrollment_id);
    const item: LessonItem = {
      sessionId: s.id,
      enrollmentId: s.enrollment_id,
      subjectId: info?.subjectId ?? "",
      subjectName: info?.subjectName ?? "",
      teacherName: info ? teacherNameById.get(info.teacherId) ?? "" : "",
      sessionNumber: s.session_number,
      unitTitle: s.unit_title,
      status: s.status,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
    };
    if (s.status === "upcoming") upcoming.push(item);
    else past.push(item);
  }

  // v3 예약(sessions/reservations) 병합 — dashboard-data.ts의 "홈" 탭과
  // 동일하게 upcomingBookings를 그대로 재사용한다(중복 판정 로직을 새로
  // 만들지 않음).
  for (const b of lessonBooking?.upcomingBookings ?? []) {
    const durationMinutes = Math.round(
      (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60_000
    );
    upcoming.push({
      sessionId: b.sessionId,
      enrollmentId: b.subjectEnrollmentId ?? "",
      subjectId: "",
      subjectName: b.subjectName,
      teacherName: b.teacherName,
      sessionNumber: null,
      unitTitle: null,
      status: "upcoming",
      scheduledAt: b.startsAt,
      durationMinutes,
    });
  }

  upcoming.sort(
    (a, b) =>
      new Date(a.scheduledAt ?? 0).getTime() -
      new Date(b.scheduledAt ?? 0).getTime()
  );
  past.sort(
    (a, b) =>
      new Date(b.scheduledAt ?? 0).getTime() -
      new Date(a.scheduledAt ?? 0).getTime()
  );

  return { upcoming, past };
}
