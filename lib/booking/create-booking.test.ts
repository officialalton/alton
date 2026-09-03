import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const reservationLookupMaybeSingleMock = vi.fn();
const idempotencyLookupMaybeSingleMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "reservations") {
    return {
      select: () => ({
        eq: (col: string) => {
          if (col === "idempotency_key") return { maybeSingle: idempotencyLookupMaybeSingleMock };
          return { maybeSingle: reservationLookupMaybeSingleMock };
        },
      }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: fromMock }),
}));

const checkTeacherFreeBusyBeforeBookingMock = vi.fn();
vi.mock("@/lib/booking/freebusy-check", () => ({
  checkTeacherFreeBusyBeforeBooking: (params: unknown) => checkTeacherFreeBusyBeforeBookingMock(params),
}));

const syncOneReservationCalendarEventMock = vi.fn();
const cancelSyncedCalendarEventMock = vi.fn();
vi.mock("@/lib/booking/calendar-sync", () => ({
  syncOneReservationCalendarEvent: (reservationId: string) => syncOneReservationCalendarEventMock(reservationId),
  cancelSyncedCalendarEvent: (params: unknown) => cancelSyncedCalendarEventMock(params),
}));

beforeEach(() => {
  vi.clearAllMocks();
  checkTeacherFreeBusyBeforeBookingMock.mockResolvedValue({ checked: false, conflict: false });
  syncOneReservationCalendarEventMock.mockResolvedValue({ outcome: "synced", googleEventId: "g1", meetLink: "https://meet.google.com/x" });
  cancelSyncedCalendarEventMock.mockResolvedValue(undefined);
  reservationLookupMaybeSingleMock.mockResolvedValue({ data: { google_event_id: "g1", owner_profile_id: "t1" } });
  idempotencyLookupMaybeSingleMock.mockResolvedValue({ data: null });
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

  it("FreeBusy를 예약 확정 전에 조회한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ reservation_id: "r1", session_id: "s1" }], error: null });
    const { confirmLessonBooking } = await import("./create-booking");
    await confirmLessonBooking({
      childId: "c", subjectEnrollmentId: "e", teacherId: "teacher1",
      startsAt: new Date("2026-10-10T19:00:00Z"), durationMinutes: 120, idempotencyKey: "k", lessonTypeId: "l",
    });
    expect(checkTeacherFreeBusyBeforeBookingMock).toHaveBeenCalledWith({
      teacherId: "teacher1",
      startsAt: new Date("2026-10-10T19:00:00Z"),
      endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    const freeBusyCallOrder = checkTeacherFreeBusyBeforeBookingMock.mock.invocationCallOrder[0];
    const rpcCallOrder = rpcMock.mock.invocationCallOrder[0];
    expect(freeBusyCallOrder).toBeLessThan(rpcCallOrder);
  });

  it("동일 idempotencyKey로 이미 예약이 존재하면 FreeBusy 재확인을 건너뛴다(자기 자신과의 충돌 오탐 방지, R6 Sandbox 실측 2026-09-03 발견)", async () => {
    idempotencyLookupMaybeSingleMock.mockResolvedValue({ data: { id: "r1" } });
    rpcMock.mockResolvedValue({ data: [{ reservation_id: "r1", session_id: "s1" }], error: null });
    const { confirmLessonBooking } = await import("./create-booking");
    const result = await confirmLessonBooking({
      childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
      startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
    });
    expect(result.reservationId).toBe("r1");
    expect(checkTeacherFreeBusyBeforeBookingMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalled();
  });

  it("FreeBusy가 실제로 겹침을 확인하면 예약을 막는다(RPC를 호출하지 않음)", async () => {
    checkTeacherFreeBusyBeforeBookingMock.mockResolvedValue({ checked: true, conflict: true });
    const { confirmLessonBooking } = await import("./create-booking");
    await expect(
      confirmLessonBooking({
        childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
        startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
      })
    ).rejects.toThrow("teacher_freebusy_conflict");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("FreeBusy를 확인하지 못했으면(checked=false) 예약을 막지 않는다", async () => {
    checkTeacherFreeBusyBeforeBookingMock.mockResolvedValue({ checked: false, conflict: false });
    rpcMock.mockResolvedValue({ data: [{ reservation_id: "r1", session_id: "s1" }], error: null });
    const { confirmLessonBooking } = await import("./create-booking");
    await expect(
      confirmLessonBooking({
        childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
        startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
      })
    ).resolves.toEqual({ reservationId: "r1", sessionId: "s1" });
  });

  it("예약 확정 직후 Calendar/Meet 동기화를 시도한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ reservation_id: "r1", session_id: "s1" }], error: null });
    const { confirmLessonBooking } = await import("./create-booking");
    await confirmLessonBooking({
      childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
      startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
    });
    expect(syncOneReservationCalendarEventMock).toHaveBeenCalledWith("r1");
  });

  it("Calendar 동기화가 예외를 던져도 예약 확정 자체는 성공한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ reservation_id: "r1", session_id: "s1" }], error: null });
    syncOneReservationCalendarEventMock.mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { confirmLessonBooking } = await import("./create-booking");
    const result = await confirmLessonBooking({
      childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
      startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
    });
    expect(result).toEqual({ reservationId: "r1", sessionId: "s1" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("r6_calendar_sync_unexpected_error"));
    errorSpy.mockRestore();
  });

  it("예약 RPC 에러 응답 시 에러를 던지고 FreeBusy만 조회한 채 RPC/동기화는 시도되지 않는다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "teacher_buffer_violation" } });
    const { confirmLessonBooking } = await import("./create-booking");
    await expect(
      confirmLessonBooking({
        childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
        startsAt: new Date(), durationMinutes: 120, idempotencyKey: "k",
      })
    ).rejects.toThrow("teacher_buffer_violation");
    expect(syncOneReservationCalendarEventMock).not.toHaveBeenCalled();
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

  it("성공한 회차마다 Calendar 동기화를 시도하고, 실패한 회차는 건너뛴다", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { occurrence_index: 0, reservation_id: "r1", session_id: "s1", starts_at: "2026-10-10T19:00:00Z", failure_reason: null },
        { occurrence_index: 1, reservation_id: null, session_id: null, starts_at: "2026-10-17T19:00:00Z", failure_reason: "사용 가능한 수업권이 없습니다." },
      ],
      error: null,
    });
    const { createWeeklyLessonSeries } = await import("./create-booking");
    await createWeeklyLessonSeries({
      childId: "c", subjectEnrollmentId: "e", teacherId: "t", lessonTypeId: "l",
      firstStartsAt: new Date("2026-10-10T19:00:00Z"), durationMinutes: 120, occurrences: 2,
      seriesTimezone: "America/Los_Angeles", idempotencyKeyPrefix: "series-1", createdBy: "admin1",
    });
    expect(syncOneReservationCalendarEventMock).toHaveBeenCalledTimes(1);
    expect(syncOneReservationCalendarEventMock).toHaveBeenCalledWith("r1");
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

  it("취소 성공 후 google_event_id가 있으면 Calendar 이벤트 삭제를 호출한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    reservationLookupMaybeSingleMock.mockResolvedValue({ data: { google_event_id: "g1", owner_profile_id: "t1" } });
    const { cancelLessonBooking } = await import("./create-booking");
    await cancelLessonBooking({ reservationId: "r1", cancelledByRole: "student", cancelledById: "c1", reason: "x" });
    expect(cancelSyncedCalendarEventMock).toHaveBeenCalledWith({
      reservationId: "r1", teacherId: "t1", googleEventId: "g1",
    });
  });

  it("google_event_id가 없으면 Calendar 이벤트 삭제를 호출하지 않는다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    reservationLookupMaybeSingleMock.mockResolvedValue({ data: { google_event_id: null, owner_profile_id: "t1" } });
    const { cancelLessonBooking } = await import("./create-booking");
    await cancelLessonBooking({ reservationId: "r1", cancelledByRole: "student", cancelledById: "c1", reason: "x" });
    expect(cancelSyncedCalendarEventMock).not.toHaveBeenCalled();
  });

  it("Calendar 이벤트 삭제가 실패해도 취소 자체는 성공한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    cancelSyncedCalendarEventMock.mockRejectedValue(new Error("delete failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cancelLessonBooking } = await import("./create-booking");
    await expect(
      cancelLessonBooking({ reservationId: "r1", cancelledByRole: "student", cancelledById: "c1", reason: "x" })
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("r6_cancel_calendar_event_delete_failed"));
    errorSpy.mockRestore();
  });
});
