import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDashboardData } from "./dashboard-data";
import type { LessonBookingData } from "./lesson-booking-data";

// 2026-09-09 UAT 정정 — 학생 홈(캘린더/예정 수업 위젯)이 레거시 enrollments/
// legacy_sessions만 조회해 (1) v3 sessions/reservations로만 예약된 예정 수업이
// 누락되고, (2) 서버 프로세스의 로컬 시간대로 "이번 달"/날짜를 판정해 자정
// 근처 수업이 학생의 실제 현지 날짜와 다른 날로 집계될 수 있던 문제를 고친다.

type Row = Record<string, unknown>;

function makeSupabase(params: {
  profile: { name: string } | null;
  enrollments: Array<{ id: string; teacher_id: string; subject: { name: string } }>;
  teacherProfiles: Array<{ id: string; name: string }>;
  legacySessions: Row[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: (cols: string) => {
            if (cols === "name") {
              return { eq: () => ({ single: () => Promise.resolve({ data: params.profile }) }) };
            }
            return { in: () => Promise.resolve({ data: params.teacherProfiles }) };
          },
        };
      }
      if (table === "enrollments") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: params.enrollments }) }),
          }),
        };
      }
      if (table === "legacy_sessions") {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: params.legacySessions }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeLessonBooking(overrides: Partial<LessonBookingData>): LessonBookingData {
  return {
    bookableEnrollments: [],
    upcomingBookings: [],
    pastSessionsForReport: [],
    timezone: "Asia/Seoul",
    ...overrides,
  };
}

describe("loadDashboardData — v3 예약 병합 + 시간대 통일(2026-09-09 UAT 정정)", () => {
  beforeEach(() => {
    // "오늘"을 2026-01-15 (UTC 기준)로 고정 — 어느 시간대로 봐도 1월 중순이라
    // "이번 달" 판정 자체는 흔들리지 않게 하고, 자정 경계 테스트는 세션의
    // scheduled_at/startsAt 값 쪽에서만 걸리게 한다.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("레거시 전용(v3 없음) — 기존 동작 그대로 유지된다", async () => {
    const supabase = makeSupabase({
      profile: { name: "지훈" },
      enrollments: [{ id: "enr1", teacher_id: "t1", subject: { name: "SAT Math" } }],
      teacherProfiles: [{ id: "t1", name: "박서연" }],
      legacySessions: [
        {
          id: "ls1",
          enrollment_id: "enr1",
          session_number: 9,
          unit_title: "이차함수",
          status: "upcoming",
          scheduled_at: "2026-01-20T05:00:00.000Z",
          duration_minutes: 60,
        },
      ],
    });

    const result = await loadDashboardData(supabase, "student1");

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({
      sessionId: "ls1",
      subjectName: "SAT Math",
      teacherName: "박서연",
      sessionNumber: 9,
    });
  });

  it("v3 전용 배정 학생 — 홈 예정 수업 위젯/캘린더에 v3 예약이 나타난다(기존 버그 재현 방지)", async () => {
    const supabase = makeSupabase({
      profile: { name: "민지" },
      enrollments: [], // 레거시 배정이 전혀 없음 — v3만으로 배정된 학생
      teacherProfiles: [],
      legacySessions: [],
    });
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "res1",
          sessionId: "sess-v3-1",
          subjectName: "SAT English",
          teacherName: "김선생",
          startsAt: "2026-01-20T05:00:00.000Z",
          endsAt: "2026-01-20T06:00:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "not_applicable",
        },
      ],
    });

    const result = await loadDashboardData(supabase, "student2", lessonBooking);

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({
      sessionId: "sess-v3-1",
      subjectName: "SAT English",
      teacherName: "김선생",
      sessionNumber: null,
      durationMinutes: 60,
    });
    // 캘린더(2026년 1월, 20일)에도 같은 세션이 잡혀야 "수업" 탭과 홈이 일치한다.
    expect(result.calendarYear).toBe(2026);
    expect(result.calendarMonth).toBe(0);
    expect(result.calendarByDay[20]).toEqual([
      { sessionId: "sess-v3-1", subjectName: "SAT English", sessionNumber: null },
    ]);
  });

  it("자정 경계 — 현지(KST) 자정 직후 수업이 서버 시간대(UTC) 기준으로는 전날/전월이어도 KST 기준 날짜로 캘린더에 잡힌다", async () => {
    const supabase = makeSupabase({
      profile: { name: "학생" },
      enrollments: [],
      teacherProfiles: [],
      legacySessions: [],
    });
    // 2026-01-01T00:30:00+09:00(KST, 1월 1일 자정 직후) === 2025-12-31T15:30:00Z(UTC로는 12월 31일).
    // 서버 로컬(UTC) 기준 순수 Date 연산이었다면 "1월 달력"에서 통째로 빠졌을 값.
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "res2",
          sessionId: "sess-midnight",
          subjectName: "SAT Math",
          teacherName: "박선생",
          startsAt: "2025-12-31T15:30:00.000Z",
          endsAt: "2025-12-31T16:30:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "not_applicable",
        },
      ],
    });

    const result = await loadDashboardData(supabase, "student3", lessonBooking);

    expect(result.calendarYear).toBe(2026);
    expect(result.calendarMonth).toBe(0); // 1월(0-indexed)
    expect(result.calendarByDay[1]).toBeDefined();
    expect(result.calendarByDay[1]?.[0]?.sessionId).toBe("sess-midnight");
    // 12월(31일) 쪽에는 잡히지 않는다(이번 달=1월 기준 캘린더이므로 day 31 키 자체가 없어야 함).
    expect(result.calendarByDay[31]).toBeUndefined();
  });

  it("레거시+v3가 함께 있으면 시작 시각 순으로 합쳐 정렬된다", async () => {
    const supabase = makeSupabase({
      profile: { name: "학생" },
      enrollments: [{ id: "enr1", teacher_id: "t1", subject: { name: "SAT Math" } }],
      teacherProfiles: [{ id: "t1", name: "박서연" }],
      legacySessions: [
        {
          id: "ls-later",
          enrollment_id: "enr1",
          session_number: 3,
          unit_title: null,
          status: "upcoming",
          scheduled_at: "2026-01-25T05:00:00.000Z",
          duration_minutes: 60,
        },
      ],
    });
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "res3",
          sessionId: "sess-earlier",
          subjectName: "SAT English",
          teacherName: "김선생",
          startsAt: "2026-01-18T05:00:00.000Z",
          endsAt: "2026-01-18T06:00:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "not_applicable",
        },
      ],
    });

    const result = await loadDashboardData(supabase, "student4", lessonBooking);

    expect(result.upcoming.map((u) => u.sessionId)).toEqual(["sess-earlier", "ls-later"]);
  });
});
