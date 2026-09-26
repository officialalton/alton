import type { SupabaseClient } from "@supabase/supabase-js";
import { dateKeyInTimezone, todayKeyInTimezone } from "@/lib/calendar-date-utils";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { isPastLesson, type TeacherLessonScheduleItem } from "./lesson-schedule-data";

export type TeacherLesson = {
  sessionId: string;
  // 레거시 legacy_sessions 기준 enrollmentId. v3 예약 병합분은 이 개념이 없어
  // 빈 문자열이다(2026-09-10 P0-4) — 이 화면에서는 실제로 안 쓰인다(클릭 이동은
  // sessionId 기준).
  enrollmentId: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  // v3 예약에는 번호가 매겨진 "회차"가 없다(단원 오버레이 기반).
  sessionNumber: number | null;
  unitTitle: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
};

export type CalendarDaySession = {
  sessionId: string;
  studentName: string;
  subjectName: string;
  sessionNumber: number | null;
};

export type TeacherDashboardData = {
  teacherName: string;
  status: string;
  upcoming: TeacherLesson[];
  past: TeacherLesson[];
  calendarByDay: Record<number, CalendarDaySession[]>;
  calendarYear: number;
  calendarMonth: number;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadTeacherDashboard(
  supabase: SupabaseClient,
  teacherId: string,
  // 2026-09-10(P0-4) — 교사 "수업" 탭이 이미 조회해둔 v3 예약
  // (loadTeacherLessonSchedule 결과, 정본)을 그대로 받아 병합한다(같은 화면에서
  // 두 번 조회하지 않기 위함, 조회 로직 복제 금지). teacherTimezone은 그 탭과
  // 동일하게 이 교사 profile.timezone 기준(app/teacher/page.tsx의
  // availabilityTimezone과 동일 소스) — 넘기지 않으면 레거시만으로 동작(하위 호환).
  lessonSchedule?: TeacherLessonScheduleItem[],
  teacherTimezone?: string
): Promise<TeacherDashboardData> {
  // 세 쿼리는 서로 독립(공통 입력은 teacherId뿐)이므로 병렬 실행한다 — 계획
  // 문서 5절 P1(기존: 순차 3회 대기).
  const [{ data: profile }, { data: teacherRow }, { data: enrollments }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", teacherId).single(),
    supabase.from("teachers").select("status").eq("id", teacherId).single(),
    supabase
      .from("enrollments")
      .select("id, student_id, subject:subjects(name)")
      .eq("teacher_id", teacherId)
      .eq("status", "active"),
  ]);

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const studentIds = Array.from(new Set((enrollments ?? []).map((e) => e.student_id)));

  const { data: studentProfiles } = studentIds.length
    ? await supabase.from("profiles").select("id, name").in("id", studentIds)
    : { data: [] as { id: string; name: string }[] };
  const studentNameById = new Map((studentProfiles ?? []).map((p) => [p.id, p.name]));

  const enrollmentInfo = new Map(
    (enrollments ?? []).map((e) => [
      e.id,
      {
        studentId: e.student_id,
        studentName: studentNameById.get(e.student_id) ?? "",
        subjectName: extractName(e.subject),
      },
    ])
  );

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("legacy_sessions")
        .select(
          "id, enrollment_id, session_number, unit_title, status, scheduled_at, duration_minutes"
        )
        .in("enrollment_id", enrollmentIds)
    : { data: [] as never[] };

  // 시간대 기준 통일(2026-09-10 P0-4) — "수업" 탭(TeacherLessonScheduleTab.tsx)이
  // 이미 dateKeyInTimezone()으로 이 교사의 timezone 기준 날짜를 계산하므로, 홈도
  // 서버 로컬 시간대 대신 같은 기준을 쓴다(학생 홈과 동일한 2026-09-09 정정 패턴).
  const timezone = teacherTimezone ?? DEFAULT_TIMEZONE;
  const todayKey = todayKeyInTimezone(timezone);
  const currentYearMonth = todayKey.slice(0, 7);
  const calendarYear = Number(todayKey.slice(0, 4));
  const calendarMonth = Number(todayKey.slice(5, 7)) - 1;

  const calendarByDay: Record<number, CalendarDaySession[]> = {};
  const upcoming: TeacherLesson[] = [];
  const past: TeacherLesson[] = [];

  for (const s of sessions ?? []) {
    const info = enrollmentInfo.get(s.enrollment_id);
    if (!info) continue;

    if (s.scheduled_at) {
      const dateKey = dateKeyInTimezone(s.scheduled_at, timezone);
      if (dateKey.slice(0, 7) === currentYearMonth) {
        const day = Number(dateKey.slice(8, 10));
        const list = calendarByDay[day] ?? [];
        list.push({
          sessionId: s.id,
          studentName: info.studentName,
          subjectName: info.subjectName,
          sessionNumber: s.session_number,
        });
        calendarByDay[day] = list;
      }
    }

    const lesson: TeacherLesson = {
      sessionId: s.id,
      enrollmentId: s.enrollment_id,
      studentId: info.studentId,
      studentName: info.studentName,
      subjectName: info.subjectName,
      sessionNumber: s.session_number,
      unitTitle: s.unit_title,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
    };
    if (s.status === "upcoming") upcoming.push(lesson);
    else if (s.status === "completed" || s.status === "no_show") past.push(lesson);
  }

  // v3 예약(sessions/reservations) 병합 — "수업" 탭이 이미 "예정/지난"을 가르는
  // 기준(isPastLesson, 리뷰 미확정 체험 수업은 지난 수업으로 넘기지 않음)을
  // 그대로 재사용한다(중복 판정 로직 신설 금지). "지난 수업"(past)은 이 화면이
  // 렌더링하지 않으므로(app/teacher/TeacherHomeDashboard.tsx 확인) 병합하지
  // 않는다 — dashboard.past는 레거시 리뷰 상태 조회(app/teacher/page.tsx)에만
  // 쓰이는 별개 용도라 여기서 건드리지 않는다.
  const nowMs = Date.now();
  for (const item of lessonSchedule ?? []) {
    if (isPastLesson(item, nowMs)) continue;

    const dateKey = dateKeyInTimezone(item.startsAt, timezone);
    if (dateKey.slice(0, 7) === currentYearMonth) {
      const day = Number(dateKey.slice(8, 10));
      const list = calendarByDay[day] ?? [];
      list.push({ sessionId: item.sessionId, studentName: item.studentName, subjectName: item.subjectName, sessionNumber: null });
      calendarByDay[day] = list;
    }
    const durationMinutes = Math.round(
      (new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 60_000
    );
    upcoming.push({
      sessionId: item.sessionId,
      enrollmentId: "",
      studentId: "",
      studentName: item.studentName,
      subjectName: item.subjectName,
      sessionNumber: null,
      unitTitle: null,
      scheduledAt: item.startsAt,
      durationMinutes,
    });
  }

  upcoming.sort(
    (a, b) =>
      new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime()
  );
  past.sort(
    (a, b) =>
      new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime()
  );

  return {
    teacherName: profile?.name ?? "선생님",
    status: teacherRow?.status ?? "pending",
    upcoming,
    past,
    calendarByDay,
    calendarYear,
    calendarMonth,
  };
}
