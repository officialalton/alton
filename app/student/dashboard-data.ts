import type { SupabaseClient } from "@supabase/supabase-js";
import { dateKeyInTimezone, todayKeyInTimezone } from "@/lib/calendar-date-utils";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { LessonBookingData } from "./lesson-booking-data";

export type UpcomingLesson = {
  sessionId: string;
  subjectName: string;
  teacherName: string;
  // v3 예약(sessions/reservations)에는 회차 개념이 없어 null일 수 있다
  // (2026-09-09 UAT 정정 — 홈 화면이 레거시 legacy_sessions만 조회해 v3
  // 전용 배정 학생의 예정 수업이 홈에서 누락되던 문제 수정).
  sessionNumber: number | null;
  unitTitle: string | null;
  scheduledAt: string;
  durationMinutes: number;
};

export type CalendarDaySession = {
  sessionId: string;
  subjectName: string;
  sessionNumber: number | null;
};

export type DashboardData = {
  studentName: string;
  upcoming: UpcomingLesson[];
  calendarByDay: Record<number, CalendarDaySession[]>;
  calendarYear: number;
  calendarMonth: number; // 0-based
  attendanceRate: number | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadDashboardData(
  supabase: SupabaseClient,
  studentId: string,
  // v3 예약 데이터 — 호출자가 이미 loadLessonBookingData()로 가져온 결과를
  // 그대로 넘긴다(같은 화면에서 두 번 조회하지 않기 위함, 2026-09-09 UAT
  // 정정). 넘기지 않으면 레거시만으로 동작(하위 호환).
  lessonBooking?: LessonBookingData
): Promise<DashboardData> {
  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", studentId).single(),
    supabase
      .from("enrollments")
      .select("id, teacher_id, subject:subjects(name)")
      .eq("student_id", studentId)
      .eq("status", "active"),
  ]);

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const teacherIds = Array.from(
    new Set((enrollments ?? []).map((e) => e.teacher_id))
  );

  // 시간대 기준 통일(2026-09-09 UAT 정정) — 이전에는 서버 프로세스의 로컬
  // 시간대(Node 실행 환경, 보통 UTC)로 "이번 달"과 "그 날짜"를 판정해,
  // 자정 근처 수업이 학생의 실제 현지 날짜와 다른 날로 집계될 수 있었다.
  // "수업" 탭의 v3 예약 캘린더(LessonBookingTab.tsx)가 이미 쓰고 있는
  // 것과 동일한 timezone 기준 날짜 키 계산(dateKeyInTimezone)으로 통일한다.
  const timezone = lessonBooking?.timezone ?? DEFAULT_TIMEZONE;
  const todayKey = todayKeyInTimezone(timezone); // "YYYY-MM-DD"(timezone 기준 오늘)
  const currentYearMonth = todayKey.slice(0, 7); // "YYYY-MM"
  const calendarYear = Number(todayKey.slice(0, 4));
  const calendarMonth = Number(todayKey.slice(5, 7)) - 1; // 0-based(기존 계약 유지)

  const [{ data: teacherProfiles }, { data: sessions }] = await Promise.all([
    teacherIds.length
      ? supabase.from("profiles").select("id, name").in("id", teacherIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    enrollmentIds.length
      ? supabase
          .from("legacy_sessions")
          .select(
            "id, enrollment_id, session_number, unit_title, status, scheduled_at, duration_minutes"
          )
          .in("enrollment_id", enrollmentIds)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const subjectByEnrollment = new Map(
    (enrollments ?? []).map((e) => [
      e.id,
      { subjectName: extractName(e.subject), teacherId: e.teacher_id },
    ])
  );
  const teacherNameById = new Map(
    (teacherProfiles ?? []).map((t) => [t.id, t.name])
  );

  const calendarByDay: Record<number, CalendarDaySession[]> = {};
  const upcoming: UpcomingLesson[] = [];
  let completedCount = 0;
  let noShowCount = 0;

  for (const s of sessions ?? []) {
    const info = subjectByEnrollment.get(s.enrollment_id);
    const subjectName = info?.subjectName ?? "";
    const teacherName = info ? teacherNameById.get(info.teacherId) ?? "" : "";

    if (s.status === "completed") completedCount++;
    if (s.status === "no_show") noShowCount++;

    if (s.scheduled_at) {
      const dateKey = dateKeyInTimezone(s.scheduled_at, timezone);
      if (dateKey.slice(0, 7) === currentYearMonth) {
        const day = Number(dateKey.slice(8, 10));
        const list = calendarByDay[day] ?? [];
        list.push({
          sessionId: s.id,
          subjectName,
          sessionNumber: s.session_number,
        });
        calendarByDay[day] = list;
      }
    }

    if (s.status === "upcoming") {
      upcoming.push({
        sessionId: s.id,
        subjectName,
        teacherName,
        sessionNumber: s.session_number,
        unitTitle: s.unit_title,
        scheduledAt: s.scheduled_at,
        durationMinutes: s.duration_minutes,
      });
    }
  }

  // v3 예약(sessions/reservations) 병합 — "수업" 탭(ClassesTab/LessonBookingTab)이
  // 이미 확정 예정 수업만 골라둔 upcomingBookings를 그대로 재사용한다(중복
  // 판정 로직을 새로 만들지 않음 — 두 화면이 서로 다른 기준으로 "예정"을
  // 판정해 다시 어긋나는 것을 막기 위함).
  for (const b of lessonBooking?.upcomingBookings ?? []) {
    const dateKey = dateKeyInTimezone(b.startsAt, timezone);
    if (dateKey.slice(0, 7) === currentYearMonth) {
      const day = Number(dateKey.slice(8, 10));
      const list = calendarByDay[day] ?? [];
      list.push({ sessionId: b.sessionId, subjectName: b.subjectName, sessionNumber: null });
      calendarByDay[day] = list;
    }
    const durationMinutes = Math.round(
      (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60_000
    );
    upcoming.push({
      sessionId: b.sessionId,
      subjectName: b.subjectName,
      teacherName: b.teacherName,
      sessionNumber: null,
      unitTitle: null,
      scheduledAt: b.startsAt,
      durationMinutes,
    });
  }

  upcoming.sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const attendanceDenominator = completedCount + noShowCount;
  const attendanceRate =
    attendanceDenominator > 0
      ? Math.round((completedCount / attendanceDenominator) * 100)
      : null;

  return {
    studentName: profile?.name ?? "학생",
    upcoming: upcoming.slice(0, 3),
    calendarByDay,
    calendarYear,
    calendarMonth,
    attendanceRate,
  };
}
