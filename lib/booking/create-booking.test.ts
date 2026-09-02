import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("confirmLessonBooking", () => {
  it("RPC를 올바른 인자로 호출하고 결과를 변환해 반환한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ reservation_id: "r1", session_id: "s1" }], error: null });
    const { confirmLessonBooking } = await import("./create-booking");

    const result = await confirmLessonBooking({
      childId: "child1",
      subjectEnrollmentId: "enr1",
      teacherId: "teacher1",
      lessonTypeId: "lt1",
      startsAt: new Date("2026-10-10T19:00:00Z"),
      durationMinutes: 120,
      idempotencyKey: "key1",
    });

    expect(result).toEqual({ reservationId: "r1", sessionId: "s1" });
    expect(rpcMock).toHaveBeenCalledWith("confirm_lesson_booking", {
      p_child_id: "child1",
      p_subject_enrollment_id: "enr1",
      p_teacher_id: "teacher1",
      p_lesson_type_id: "lt1",
      p_starts_at: "2026-10-10T19:00:00.000Z",
      p_ends_at: "2026-10-10T21:00:00.000Z",
      p_idempotency_key: "key1",
      p_admin_override: false,
    });
  });

  it("에러 응답 시 에러를 던진다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "teacher_buffer_violation" } });
    const { confirmLessonBooking } = await import("./create-booking");
    await expect(
      confirmLessonBooking({
        childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
        startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
      })
    ).rejects.toThrow("teacher_buffer_violation");
  });
});

describe("createWeeklyLessonSeries", () => {
  it("occurrences 배열을 카멜케이스로 변환한다(성공/실패 혼합)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { occurrence_index: 0, reservation_id: "r1", session_id: "s1", starts_at: "2026-10-10T19:00:00Z", failure_reason: null },
        { occurrence_index: 1, reservation_id: null, session_id: null, starts_at: "2026-10-17T19:00:00Z", failure_reason: "사용 가능한 수업권이 없습니다." },
      ],
      error: null,
    });
    const { createWeeklyLessonSeries } = await import("./create-booking");

    const result = await createWeeklyLessonSeries({
      childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
      firstStartsAt: new Date("2026-10-10T19:00:00Z"), durationMinutes: 120, occurrences: 2,
      seriesTimezone: "America/Los_Angeles", idempotencyKeyPrefix: "series-1", createdBy: "admin1",
    });

    expect(result).toEqual([
      { occurrenceIndex: 0, reservationId: "r1", sessionId: "s1", startsAt: "2026-10-10T19:00:00Z", failureReason: null },
      { occurrenceIndex: 1, reservationId: null, sessionId: null, startsAt: "2026-10-17T19:00:00Z", failureReason: "사용 가능한 수업권이 없습니다." },
    ]);
  });
});

describe("cancelLessonBooking", () => {
  it("RPC를 올바른 인자로 호출한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { cancelLessonBooking } = await import("./create-booking");
    await cancelLessonBooking({ reservationId: "r1", cancelledByRole: "student", cancelledById: "c1", reason: "일정 변경" });
    expect(rpcMock).toHaveBeenCalledWith("cancel_lesson_booking", {
      p_reservation_id: "r1",
      p_cancelled_by_role: "student",
      p_cancelled_by_id: "c1",
      p_reason: "일정 변경",
    });
  });

  it("에러 응답 시 에러를 던진다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "확정된 예약만 취소할 수 있습니다." } });
    const { cancelLessonBooking } = await import("./create-booking");
    await expect(
      cancelLessonBooking({ reservationId: "r1", cancelledByRole: "student", cancelledById: "c1", reason: "x" })
    ).rejects.toThrow("확정된 예약만 취소할 수 있습니다.");
  });
});
