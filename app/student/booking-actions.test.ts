import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "student1" }, supabase: {} }),
}));

const teacherAssignmentMaybeSingleMock = vi.fn();
const reservationOwnerMaybeSingleMock = vi.fn();
const adminFromMock = vi.fn((table: string) => {
  if (table === "teacher_assignments") {
    return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: teacherAssignmentMaybeSingleMock }) }) }) }) };
  }
  if (table === "reservations") {
    return { select: () => ({ eq: () => ({ maybeSingle: reservationOwnerMaybeSingleMock }) }) };
  }
  throw new Error(`unexpected admin table ${table}`);
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

const confirmLessonBookingMock = vi.fn();
const createWeeklyLessonSeriesMock = vi.fn();
const cancelLessonBookingMock = vi.fn();
vi.mock("@/lib/booking/create-booking", () => ({
  confirmLessonBooking: (p: unknown) => confirmLessonBookingMock(p),
  createWeeklyLessonSeries: (p: unknown) => createWeeklyLessonSeriesMock(p),
  cancelLessonBooking: (p: unknown) => cancelLessonBookingMock(p),
}));

beforeEach(() => {
  vi.clearAllMocks();
  teacherAssignmentMaybeSingleMock.mockResolvedValue({ data: { id: "ta1" } });
  reservationOwnerMaybeSingleMock.mockResolvedValue({ data: { subject_enrollment: { child_id: "student1" } } });
  confirmLessonBookingMock.mockResolvedValue({ reservationId: "r1", sessionId: "s1" });
  createWeeklyLessonSeriesMock.mockResolvedValue([]);
  cancelLessonBookingMock.mockResolvedValue(undefined);
});

describe("createMyLessonBooking", () => {
  it("본인 id를 childId로 전달한다", async () => {
    const { createMyLessonBooking } = await import("./booking-actions");
    const result = await createMyLessonBooking({
      subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1",
      startsAt: new Date("2026-10-10T19:00:00Z"), durationMinutes: 120,
    });
    expect(result).toEqual({ reservationId: "r1", sessionId: "s1" });
    expect(confirmLessonBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({ childId: "student1", teacherId: "t1" })
    );
  });

  it("배정된 선생님이 아니면 거부한다", async () => {
    teacherAssignmentMaybeSingleMock.mockResolvedValue({ data: null });
    const { createMyLessonBooking } = await import("./booking-actions");
    await expect(
      createMyLessonBooking({ subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1", startsAt: new Date(), durationMinutes: 120 })
    ).rejects.toThrow("현재 배정된 선생님이 아닙니다");
  });
});

describe("cancelMyLessonBooking", () => {
  it("본인 예약이면 취소를 호출한다", async () => {
    const { cancelMyLessonBooking } = await import("./booking-actions");
    await cancelMyLessonBooking({ reservationId: "r1", reason: "일정 변경" });
    expect(cancelLessonBookingMock).toHaveBeenCalledWith({
      reservationId: "r1", cancelledByRole: "student", cancelledById: "student1", reason: "일정 변경",
    });
  });

  it("본인 예약이 아니면 거부한다", async () => {
    reservationOwnerMaybeSingleMock.mockResolvedValue({ data: { subject_enrollment: { child_id: "other-student" } } });
    const { cancelMyLessonBooking } = await import("./booking-actions");
    await expect(
      cancelMyLessonBooking({ reservationId: "r1", reason: "x" })
    ).rejects.toThrow("본인(또는 자녀) 예약만 취소할 수 있습니다.");
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
  });
});
