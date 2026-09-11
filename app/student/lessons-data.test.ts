import { describe, expect, it, vi } from "vitest";
import { loadLessons } from "./lessons-data";
import type { LessonBookingData } from "./lesson-booking-data";

// 2026-09-11 — "수업" 탭(LessonsTab, 학생/학부모 공용) 예정 수업 목록이
// 레거시 enrollments/legacy_sessions만 조회해 v3 sessions/reservations로만
// 예약된 예정 수업이 누락되던 문제(제품 오너 실사용 보고: 학부모 뷰 "수업"
// 탭에 자녀 수업이 안 보임). app/student/dashboard-data.ts가 "홈" 탭에서
// 이미 쓰던 v3 병합 패턴을 그대로 적용했는지 고정한다.

type Row = Record<string, unknown>;

function makeSupabase(params: {
  enrollments: Array<{ id: string; teacher_id: string; subject_id: string; subject: { name: string } }>;
  teacherProfiles: Array<{ id: string; name: string }>;
  legacySessions: Row[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "enrollments") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: params.enrollments }) }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.teacherProfiles }) }) };
      }
      if (table === "legacy_sessions") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: params.legacySessions }),
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

describe("loadLessons — v3 예약 병합", () => {
  it("레거시 세션이 전혀 없어도(v3 전용 배정) v3 예정 수업을 upcoming에 포함한다", async () => {
    const supabase = makeSupabase({ enrollments: [], teacherProfiles: [], legacySessions: [] });
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "r1",
          sessionId: "s1",
          subjectEnrollmentId: "se1",
          subjectName: "AP Calculus AB",
          teacherName: "박서연 선생님",
          startsAt: "2026-09-12T09:00:00.000Z",
          endsAt: "2026-09-12T10:00:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "synced",
        },
      ],
    });

    const { upcoming, past } = await loadLessons(supabase, "student1", lessonBooking);

    expect(past).toEqual([]);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({
      sessionId: "s1",
      subjectName: "AP Calculus AB",
      teacherName: "박서연 선생님",
      sessionNumber: null,
      scheduledAt: "2026-09-12T09:00:00.000Z",
      durationMinutes: 60,
    });
  });

  it("레거시 예정 수업과 v3 예정 수업을 함께 반환하고 시간순으로 정렬한다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e1", teacher_id: "t1", subject_id: "sub1", subject: { name: "SAT Math" } }],
      teacherProfiles: [{ id: "t1", name: "이도현 선생님" }],
      legacySessions: [
        {
          id: "legacy1",
          enrollment_id: "e1",
          session_number: 5,
          unit_title: "Unit 3",
          status: "upcoming",
          scheduled_at: "2026-09-15T09:00:00.000Z",
          duration_minutes: 60,
        },
      ],
    });
    const lessonBooking = makeLessonBooking({
      upcomingBookings: [
        {
          reservationId: "r1",
          sessionId: "v3-1",
          subjectEnrollmentId: "se1",
          subjectName: "AP Calculus AB",
          teacherName: "박서연 선생님",
          startsAt: "2026-09-10T09:00:00.000Z",
          endsAt: "2026-09-10T10:00:00.000Z",
          googleMeetLink: null,
          googleSyncStatus: "synced",
        },
      ],
    });

    const { upcoming } = await loadLessons(supabase, "student1", lessonBooking);

    expect(upcoming.map((l) => l.sessionId)).toEqual(["v3-1", "legacy1"]);
  });

  it("lessonBooking을 넘기지 않으면 기존처럼 레거시만 반환한다(하위 호환)", async () => {
    const supabase = makeSupabase({ enrollments: [], teacherProfiles: [], legacySessions: [] });

    const { upcoming, past } = await loadLessons(supabase, "student1");

    expect(upcoming).toEqual([]);
    expect(past).toEqual([]);
  });
});
