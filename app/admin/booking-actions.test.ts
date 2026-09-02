import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: {}, actorUserId: "admin1" }),
}));

const confirmLessonBookingMock = vi.fn();
const cancelLessonBookingMock = vi.fn();
vi.mock("@/lib/booking/create-booking", () => ({
  confirmLessonBooking: (p: unknown) => confirmLessonBookingMock(p),
  cancelLessonBooking: (p: unknown) => cancelLessonBookingMock(p),
}));

const processPendingCalendarSyncsMock = vi.fn();
vi.mock("@/lib/booking/calendar-sync", () => ({
  processPendingCalendarSyncs: () => processPendingCalendarSyncsMock(),
}));

const reservationsOrderMock = vi.fn();
const adminFromMock = vi.fn((table: string) => {
  if (table === "reservations") {
    return { select: () => ({ in: () => ({ order: reservationsOrderMock }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  confirmLessonBookingMock.mockResolvedValue({ reservationId: "r1", sessionId: "s1" });
  cancelLessonBookingMock.mockResolvedValue(undefined);
  processPendingCalendarSyncsMock.mockResolvedValue({ attempted: 2, succeeded: 1, failed: 1, reconciliationNeeded: 0, skippedRace: 0 });
  reservationsOrderMock.mockResolvedValue({
    data: [
      {
        id: "r1", owner_profile_id: "t1", starts_at: "2026-10-10T19:00:00Z",
        google_sync_status: "reconciliation_needed", google_sync_error: "boom", google_sync_retry_count: 6,
        teacher: { name: "김선생" },
      },
    ],
    error: null,
  });
});

describe("adminCreateLessonBooking", () => {
  it("adminOverride=true로 confirmLessonBooking을 호출한다", async () => {
    const { adminCreateLessonBooking } = await import("./booking-actions");
    const result = await adminCreateLessonBooking({
      childId: "c1", subjectEnrollmentId: "e1", teacherId: "t1", lessonTypeId: "lt1",
      startsAt: new Date("2026-10-10T19:00:00Z"), durationMinutes: 120,
    });
    expect(result).toEqual({ reservationId: "r1", sessionId: "s1" });
    expect(confirmLessonBookingMock).toHaveBeenCalledWith(expect.objectContaining({ adminOverride: true }));
  });
});

describe("adminCancelLessonBooking", () => {
  it("actorUserId를 cancelledById로 사용해 취소한다", async () => {
    const { adminCancelLessonBooking } = await import("./booking-actions");
    await adminCancelLessonBooking({ reservationId: "r1", cancelledByRole: "company", reason: "시스템 장애" });
    expect(cancelLessonBookingMock).toHaveBeenCalledWith({
      reservationId: "r1", cancelledByRole: "company", cancelledById: "admin1", reason: "시스템 장애",
    });
  });
});

describe("listReconciliationNeededBookings", () => {
  it("reconciliation_needed/failed 상태 예약을 카멜케이스로 변환해 반환한다", async () => {
    const { listReconciliationNeededBookings } = await import("./booking-actions");
    const rows = await listReconciliationNeededBookings();
    expect(rows).toEqual([
      {
        reservationId: "r1", teacherId: "t1", teacherName: "김선생", startsAt: "2026-10-10T19:00:00Z",
        googleSyncStatus: "reconciliation_needed", googleSyncError: "boom", googleSyncRetryCount: 6,
      },
    ]);
  });
});

describe("retryCalendarSyncNow", () => {
  it("processPendingCalendarSyncs 결과를 그대로 전달한다", async () => {
    const { retryCalendarSyncNow } = await import("./booking-actions");
    const result = await retryCalendarSyncNow();
    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1, reconciliationNeeded: 0 });
  });
});
