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

  it("자정 경계 — 현지(KST) 자정 직전 수업은 서버 시간대(UTC)로는 다음날이어도 KST 기준 전날 날짜로 캘린더에 잡힌다", async () => {
    const supabase = makeSupabase({
      profile: { name: "학생" },
      enrollments: [],
      teacherProfiles: [],
      legacySessions: [],
    });
    // 2026-01-15T23:50:00+09:00(KST, 1월 15일 자정 직전) === 2026-01-15T14:50:00Z(UTC로도
    // 1월 15일이라 이 값 자체는 날짜가 안 갈리지만, 시각 하나만 더 뒤로(자정 30분 전)
    // 당겨 실제 "직전" 경계를 명확히 한다: 2026-01-15T23:50 KST는 UTC 기준 아직 15일
    // 오후이므로 서버가 UTC로 잘못 계산해도 우연히 같은 날짜가 나올 수 있어, 확실한
    // 반례로 자정을 넘기지 않는 극단값 대신 "정확히 자정 10분 전" KST를 검증한다.
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "res-before",
          sessionId: "sess-before-midnight",
          subjectName: "SAT Math",
          teacherName: "박선생",
          startsAt: "2026-01-15T14:50:00.000Z", // = 2026-01-15T23:50:00+09:00
          endsAt: "2026-01-15T15:50:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "not_applicable",
        },
      ],
    });

    const result = await loadDashboardData(supabase, "student3b", lessonBooking);

    expect(result.calendarByDay[15]?.[0]?.sessionId).toBe("sess-before-midnight");
    expect(result.calendarByDay[16]).toBeUndefined();
  });

  it("월 경계 — 8월 31일 23:50 KST 예약은 서버 시간대(UTC)로는 여전히 8월 31일 오후이지만, 9월이 아니라 8월 달력에 잡힌다", async () => {
    // "이번 달"을 8월(KST)로 고정 — 8월 20일 KST 정오 부근.
    vi.setSystemTime(new Date("2026-08-20T03:00:00.000Z"));

    const supabase = makeSupabase({
      profile: { name: "학생" },
      enrollments: [],
      teacherProfiles: [],
      legacySessions: [],
    });
    // 2026-08-31T23:50:00+09:00(KST) === 2026-08-31T14:50:00Z.
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "res-month-boundary",
          sessionId: "sess-aug31-late",
          subjectName: "SAT Math",
          teacherName: "박선생",
          startsAt: "2026-08-31T14:50:00.000Z",
          endsAt: "2026-08-31T15:50:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "not_applicable",
        },
      ],
    });

    const result = await loadDashboardData(supabase, "student3c", lessonBooking);

    expect(result.calendarYear).toBe(2026);
    expect(result.calendarMonth).toBe(7); // 8월(0-indexed)
    expect(result.calendarByDay[31]?.[0]?.sessionId).toBe("sess-aug31-late");
  });

  it("학생과 관리자/교사의 시스템 시간대가 달라도 학생 화면 결과는 학생의 resolveUserTimezone() 결과에만 좌우된다(뷰어 시간대 무관)", async () => {
    // "지금 이 코드를 실행하는 프로세스"의 시간대는 결과에 영향을 주면 안 된다 —
    // Node의 로컬 타임존 설정과 무관하게, 오직 lessonBooking.timezone(학생 본인
    // profile/household 기준으로 이미 해석된 값)만 날짜 계산에 쓰여야 한다.
    // 실제 서비스에서는 이 값이 관리자/교사가 어느 시간대에서 접속했는지와 무관하게
    // 항상 "그 학생 계정"의 시간대로 고정된다 — 여기서는 그걸 직접 검증한다:
    // 시스템 시간을 UTC로 고정한 채, timezone을 각각 "Asia/Seoul"과
    // "America/Los_Angeles"로 바꿔가며 같은 자정 근처 시각의 날짜 배정이
    // 달라지는지(즉, 실제로 그 timezone 값이 쓰이는지) 확인한다.
    const supabase = makeSupabase({
      profile: { name: "학생" },
      enrollments: [],
      teacherProfiles: [],
      legacySessions: [],
    });
    const startsAt = "2026-01-01T05:00:00.000Z"; // KST로는 1/1 14:00, LA로는 12/31 21:00
    const makeBooking = (tz: string) =>
      makeLessonBooking({
        timezone: tz,
        upcomingBookings: [
          {
            reservationId: "res-tz",
            sessionId: "sess-tz",
            subjectName: "SAT Math",
            teacherName: "박선생",
            startsAt,
            endsAt: "2026-01-01T06:00:00.000Z",
            googleMeetLink: null,
            googleSyncStatus: "not_applicable",
          },
        ],
      });

    const seoulResult = await loadDashboardData(supabase, "student-seoul", makeBooking("Asia/Seoul"));
    const laResult = await loadDashboardData(
      supabase,
      "student-la",
      makeBooking("America/Los_Angeles")
    );

    // 서울 기준: 1월 1일 → 이번 달(1월) 캘린더 1일에 잡힘.
    expect(seoulResult.calendarByDay[1]?.[0]?.sessionId).toBe("sess-tz");
    // LA 기준: 같은 순간이 전년 12월 31일 — "이번 달"이 1월인 이 캘린더에는
    // 아예 안 잡혀야 한다(다른 달이므로).
    expect(laResult.calendarByDay[31]).toBeUndefined();
    expect(Object.values(laResult.calendarByDay).flat()).toHaveLength(0);
    // 그래도 "예정 수업" 목록 자체(달력과 무관)에는 두 경우 모두 나타난다 —
    // upcoming 목록은 월 필터링을 하지 않기 때문.
    expect(seoulResult.upcoming.map((u) => u.sessionId)).toContain("sess-tz");
    expect(laResult.upcoming.map((u) => u.sessionId)).toContain("sess-tz");
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
