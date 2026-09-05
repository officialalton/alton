import { describe, expect, it, vi } from "vitest";
import { loadLessonBookingData } from "./lesson-booking-data";

const REGULAR_TYPE = { id: "lt-regular", code: "regular", duration_minutes: 120 };
const TRIAL_TYPE = { id: "lt-trial", code: "trial", duration_minutes: 60 };

function makeSupabase(params: {
  enrollments: Array<{ id: string; subject_id: string; status: string; subject: { name: string } }>;
  assignments: Array<{
    id: string;
    subject_enrollment_id: string;
    teacher_id: string;
    status: string;
    effective_from: string;
    effective_until: string | null;
    reason: string | null;
    teacher: { name: string };
  }>;
  hasTrialGrant: boolean;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "subject_enrollments") {
        return {
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: params.enrollments }) }),
          }),
        };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({
            in: () => ({ order: () => Promise.resolve({ data: params.assignments }) }),
          }),
        };
      }
      if (table === "lesson_types") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [REGULAR_TYPE, TRIAL_TYPE] }),
          }),
        };
      }
      if (table === "entitlement_grants") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: params.hasTrialGrant ? { id: "grant1" } : null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "sessions") {
        return { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [] }) }) }) };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      if (table === "household_members") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadLessonBookingData — 체험 학생도 정규수업과 동일하게 직접 예약 가능해야 한다", () => {
  it("정규(active) 수강은 그대로 regular 수업권으로 예약 가능하다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e1", subject_id: "sub1", status: "active", subject: { name: "SAT Math" } }],
      assignments: [
        {
          id: "a1",
          subject_enrollment_id: "e1",
          teacher_id: "t1",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "김선생" },
        },
      ],
      hasTrialGrant: false,
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.bookableEnrollments).toEqual([
      {
        subjectEnrollmentId: "e1",
        subjectName: "SAT Math",
        teacherId: "t1",
        teacherName: "김선생",
        lessonTypeId: "lt-regular",
        lessonDurationMinutes: 120,
        isTrial: false,
      },
    ]);
  });

  it("체험(planned) 수강도 선생님이 배정되고 체험수업권이 지급됐으면 학생이 직접 예약할 수 있다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e2", subject_id: "sub1", status: "planned", subject: { name: "AP Calculus AB" } }],
      assignments: [
        {
          id: "a2",
          subject_enrollment_id: "e2",
          teacher_id: "t2",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "장선생" },
        },
      ],
      hasTrialGrant: true,
    });

    const result = await loadLessonBookingData(supabase as never, "child2");
    expect(result.bookableEnrollments).toEqual([
      {
        subjectEnrollmentId: "e2",
        subjectName: "AP Calculus AB",
        teacherId: "t2",
        teacherName: "장선생",
        lessonTypeId: "lt-trial",
        lessonDurationMinutes: 60,
        isTrial: true,
      },
    ]);
  });

  it("체험(planned) 수강이라도 체험수업권이 아직 지급되지 않았으면 예약 후보에 넣지 않는다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e3", subject_id: "sub1", status: "planned", subject: { name: "AP Calculus AB" } }],
      assignments: [
        {
          id: "a3",
          subject_enrollment_id: "e3",
          teacher_id: "t3",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "이선생" },
        },
      ],
      hasTrialGrant: false,
    });

    const result = await loadLessonBookingData(supabase as never, "child3");
    expect(result.bookableEnrollments).toEqual([]);
  });

  it("선생님 배정이 없으면 상태와 무관하게 예약 후보가 아니다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e4", subject_id: "sub1", status: "active", subject: { name: "SAT Math" } }],
      assignments: [],
      hasTrialGrant: true,
    });

    const result = await loadLessonBookingData(supabase as never, "child4");
    expect(result.bookableEnrollments).toEqual([]);
  });
});
