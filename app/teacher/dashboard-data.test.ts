import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTeacherDashboard } from "./dashboard-data";
import type { TeacherLessonScheduleItem } from "./lesson-schedule-data";

// 2026-09-10(P0-4) — 교사 홈 대시보드가 레거시 legacy_sessions만 조회해 "수업" 탭
// (v3 sessions/reservations)에는 보이는 예정 수업이 홈에서는 누락되던 문제를 고친다.
// 학생 홈(2026-09-09 정정)과 동일한 패턴: v3 조회 정본(loadTeacherLessonSchedule)의
// 결과를 그대로 받아 병합하고, isPastLesson()도 그대로 재사용한다.

function makeSupabase(params: {
  profile: { name: string } | null;
  teacherRow: { status: string } | null;
  enrollments: Array<{ id: string; student_id: string; subject: { name: string } }>;
  studentProfiles: Array<{ id: string; name: string }>;
  legacySessions: Array<Record<string, unknown>>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: (cols: string) => {
            if (cols === "name") {
              return { eq: () => ({ single: () => Promise.resolve({ data: params.profile }) }) };
            }
            return { in: () => Promise.resolve({ data: params.studentProfiles }) };
          },
        };
      }
      if (table === "teachers") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: params.teacherRow }) }) }) };
      }
      if (table === "enrollments") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: params.enrollments }) }),
          }),
        };
      }
      if (table === "legacy_sessions") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.legacySessions }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeItem(overrides: Partial<TeacherLessonScheduleItem>): TeacherLessonScheduleItem {
  return {
    reservationId: "res1",
    sessionId: "sess-v3",
    studentName: "민지",
    subjectName: "SAT English",
    startsAt: "2026-01-20T05:00:00.000Z",
    endsAt: "2026-01-20T06:00:00.000Z",
    status: "confirmed",
    googleMeetLink: null,
    googleSyncStatus: "not_applicable",
    externalChangeStatus: "none",
    isTrial: false,
    smartNotesDriveFileId: null,
    finalStatus: "scheduled",
    subjectEnrollmentId: "se1",
    reviewStatus: "none",
    ...overrides,
  };
}

describe("loadTeacherDashboard — v3 예약 병합 + 시간대 통일(2026-09-10 P0-4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T03:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("레거시 전용(v3 없음) — 기존 동작 그대로 유지된다", async () => {
    const supabase = makeSupabase({
      profile: { name: "박서연" },
      teacherRow: { status: "active" },
      enrollments: [{ id: "enr1", student_id: "st1", subject: { name: "SAT Math" } }],
      studentProfiles: [{ id: "st1", name: "지훈" }],
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

    const result = await loadTeacherDashboard(supabase, "teacher1");

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({ sessionId: "ls1", studentName: "지훈", sessionNumber: 9 });
  });

  it("v3 전용 배정 — 교사 홈 예정 수업 위젯/캘린더에 v3 예약이 나타난다(기존 버그 재현 방지)", async () => {
    const supabase = makeSupabase({
      profile: { name: "박서연" },
      teacherRow: { status: "active" },
      enrollments: [],
      studentProfiles: [],
      legacySessions: [],
    });
    const lessonSchedule = [makeItem({})];

    const result = await loadTeacherDashboard(supabase, "teacher1", lessonSchedule, "Asia/Seoul");

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({
      sessionId: "sess-v3",
      studentName: "민지",
      subjectName: "SAT English",
      sessionNumber: null,
      durationMinutes: 60,
    });
    expect(result.calendarByDay[20]).toEqual([
      { sessionId: "sess-v3", studentName: "민지", subjectName: "SAT English", sessionNumber: null },
    ]);
  });

  it("리뷰 미확정 체험 수업(isPastLesson=false)은 종료 시각이 지났어도 예정 수업에 남는다 — '수업' 탭과 동일 판정", async () => {
    const supabase = makeSupabase({
      profile: { name: "박서연" },
      teacherRow: { status: "active" },
      enrollments: [],
      studentProfiles: [],
      legacySessions: [],
    });
    const lessonSchedule = [
      makeItem({
        sessionId: "sess-trial-unreviewed",
        isTrial: true,
        reviewStatus: "none",
        startsAt: "2026-01-10T05:00:00.000Z", // 이미 지난 시각(시스템 시간 1/15 기준)
        endsAt: "2026-01-10T06:00:00.000Z",
      }),
    ];

    const result = await loadTeacherDashboard(supabase, "teacher1", lessonSchedule, "Asia/Seoul");

    expect(result.upcoming.map((u) => u.sessionId)).toContain("sess-trial-unreviewed");
  });

  it("리뷰 확정된 체험 수업(isPastLesson=true)은 홈 예정 수업에서 빠진다", async () => {
    const supabase = makeSupabase({
      profile: { name: "박서연" },
      teacherRow: { status: "active" },
      enrollments: [],
      studentProfiles: [],
      legacySessions: [],
    });
    const lessonSchedule = [
      makeItem({
        sessionId: "sess-trial-reviewed",
        isTrial: true,
        reviewStatus: "final",
        startsAt: "2026-01-10T05:00:00.000Z",
        endsAt: "2026-01-10T06:00:00.000Z",
      }),
    ];

    const result = await loadTeacherDashboard(supabase, "teacher1", lessonSchedule, "Asia/Seoul");

    expect(result.upcoming.map((u) => u.sessionId)).not.toContain("sess-trial-reviewed");
  });

  it("자정 경계 — 교사 본인(KST) 자정 직후 v3 수업이 서버 시간대(UTC) 기준 전날이어도 올바른 날짜에 잡힌다", async () => {
    const supabase = makeSupabase({
      profile: { name: "박서연" },
      teacherRow: { status: "active" },
      enrollments: [],
      studentProfiles: [],
      legacySessions: [],
    });
    // 2026-01-20T15:30:00Z(UTC로는 1월 20일) === 2026-01-21T00:30:00+09:00(KST로는
    // 1월 21일 자정 직후) — 시스템 시각(1/15) 기준 미래라 isPastLesson에도 안 걸린다.
    const lessonSchedule = [
      makeItem({
        sessionId: "sess-midnight",
        startsAt: "2026-01-20T15:30:00.000Z",
        endsAt: "2026-01-20T16:30:00.000Z",
      }),
    ];

    const result = await loadTeacherDashboard(supabase, "teacher1", lessonSchedule, "Asia/Seoul");

    expect(result.calendarYear).toBe(2026);
    expect(result.calendarMonth).toBe(0);
    expect(result.calendarByDay[21]?.[0]?.sessionId).toBe("sess-midnight");
    expect(result.calendarByDay[20]).toBeUndefined();
  });
});
