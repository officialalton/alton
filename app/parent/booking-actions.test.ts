import { beforeEach, describe, expect, it, vi } from "vitest";

const guardianLinksMock = vi.fn();
const childLinkMaybeSingleMock = vi.fn();

const userSupabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "household_members") {
      return {
        select: () => ({
          eq: () => ({
            eq: (col: string, val: string) => {
              if (col === "role" && val === "guardian") {
                return guardianLinksMock();
              }
              return { in: () => ({ maybeSingle: childLinkMaybeSingleMock }) };
            },
          }),
        }),
      };
    }
    throw new Error(`unexpected user-client table ${table}`);
  }),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "guardian1" }, supabase: userSupabaseMock }),
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
  if (table === "profiles") {
    return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
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
  guardianLinksMock.mockResolvedValue({ data: [{ household_id: "hh1" }] });
  childLinkMaybeSingleMock.mockResolvedValue({ data: { household_id: "hh1" } });
  teacherAssignmentMaybeSingleMock.mockResolvedValue({ data: { id: "ta1" } });
  reservationOwnerMaybeSingleMock.mockResolvedValue({ data: { subject_enrollment: { child_id: "child1" } } });
  confirmLessonBookingMock.mockResolvedValue({ reservationId: "r1", sessionId: "s1" });
  createWeeklyLessonSeriesMock.mockResolvedValue([]);
  cancelLessonBookingMock.mockResolvedValue(undefined);
});

describe("createLessonBookingForChild", () => {
  it("가족 구성원이 아닌 자녀는 거부한다", async () => {
    childLinkMaybeSingleMock.mockResolvedValue({ data: null });
    const { createLessonBookingForChild } = await import("./booking-actions");
    await expect(
      createLessonBookingForChild({
        childId: "child1", subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1",
        startsAt: new Date(), durationMinutes: 120,
      })
    ).rejects.toThrow("본인 가족 구성원이 아닌 자녀");
    expect(confirmLessonBookingMock).not.toHaveBeenCalled();
  });

  it("현재 배정된 선생님이 아니면 거부한다", async () => {
    teacherAssignmentMaybeSingleMock.mockResolvedValue({ data: null });
    const { createLessonBookingForChild } = await import("./booking-actions");
    await expect(
      createLessonBookingForChild({
        childId: "child1", subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1",
        startsAt: new Date(), durationMinutes: 120,
      })
    ).rejects.toThrow("현재 배정된 선생님이 아닙니다");
  });

  it("검증 통과 시 confirmLessonBooking을 idempotencyKey와 함께 호출한다", async () => {
    const { createLessonBookingForChild } = await import("./booking-actions");
    const startsAt = new Date("2026-10-10T19:00:00Z");
    const result = await createLessonBookingForChild({
      childId: "child1", subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1",
      startsAt, durationMinutes: 120,
    });
    expect(result).toEqual({ reservationId: "r1", sessionId: "s1" });
    expect(confirmLessonBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "child1", teacherId: "t1", startsAt,
        idempotencyKey: expect.stringContaining("guardian-booking:child1:e1:"),
      })
    );
  });
});

describe("createWeeklyLessonSeriesForChild", () => {
  it("검증 통과 시 createdBy=guardian id로 시리즈를 생성한다", async () => {
    const { createWeeklyLessonSeriesForChild } = await import("./booking-actions");
    await createWeeklyLessonSeriesForChild({
      childId: "child1", subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1",
      firstStartsAt: new Date("2026-10-10T19:00:00Z"), durationMinutes: 120, occurrences: 4,
      seriesTimezone: "America/Los_Angeles",
    });
    expect(createWeeklyLessonSeriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "guardian1", occurrences: 4 })
    );
  });
});

describe("cancelLessonBookingForChild", () => {
  it("cancelledByRole='student'로 취소를 호출한다(보호자가 학생 대신 취소)", async () => {
    const { cancelLessonBookingForChild } = await import("./booking-actions");
    await cancelLessonBookingForChild({ reservationId: "r1", childId: "child1", reason: "일정 변경" });
    expect(cancelLessonBookingMock).toHaveBeenCalledWith({
      reservationId: "r1",
      cancelledByRole: "student",
      cancelledById: "guardian1",
      reason: "일정 변경",
    });
  });

  it("가족 구성원이 아닌 자녀는 취소도 거부한다", async () => {
    childLinkMaybeSingleMock.mockResolvedValue({ data: null });
    const { cancelLessonBookingForChild } = await import("./booking-actions");
    await expect(
      cancelLessonBookingForChild({ reservationId: "r1", childId: "child1", reason: "x" })
    ).rejects.toThrow("본인 가족 구성원이 아닌 자녀");
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
  });

  it("예약이 실제로 그 자녀 것이 아니면 거부한다(childId 바꿔치기 방지)", async () => {
    reservationOwnerMaybeSingleMock.mockResolvedValue({ data: { subject_enrollment: { child_id: "someone-elses-child" } } });
    const { cancelLessonBookingForChild } = await import("./booking-actions");
    await expect(
      cancelLessonBookingForChild({ reservationId: "r1", childId: "child1", reason: "x" })
    ).rejects.toThrow("본인(또는 자녀) 예약만 취소할 수 있습니다.");
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
  });
});
