import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const updatePayloads: Array<Record<string, unknown>> = [];
const fromMock = vi.fn(() => ({
  update: (payload: Record<string, unknown>) => {
    updatePayloads.push(payload);
    return { eq: async () => ({ error: null }) };
  },
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: fromMock }),
}));

const patchCalendarEventTimeMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  patchCalendarEventTime: (params: unknown) => patchCalendarEventTimeMock(params),
}));

const syncOneReservationCalendarEventMock = vi.fn();
vi.mock("@/lib/booking/calendar-sync", () => ({
  syncOneReservationCalendarEvent: (reservationId: string) => syncOneReservationCalendarEventMock(reservationId),
}));

beforeEach(() => {
  vi.clearAllMocks();
  updatePayloads.length = 0;
  rpcMock.mockResolvedValue({ error: null });
  patchCalendarEventTimeMock.mockResolvedValue(undefined);
  syncOneReservationCalendarEventMock.mockResolvedValue({ outcome: "synced", googleEventId: "g2", meetLink: "https://meet.google.com/new-code-xyz" });
});

describe("acceptGoogleTimeForReservation", () => {
  it("reschedule_reservation_to_google_time RPC를 올바른 인자로 호출한다", async () => {
    const { acceptGoogleTimeForReservation } = await import("./external-change-resolution");
    await acceptGoogleTimeForReservation({
      reservationId: "r1",
      googleStartsAt: "2026-10-01T20:00:00Z",
      googleEndsAt: "2026-10-01T22:00:00Z",
      adminId: "admin1",
      reason: "선생님 확인",
    });
    expect(rpcMock).toHaveBeenCalledWith("reschedule_reservation_to_google_time", {
      p_reservation_id: "r1",
      p_new_starts_at: "2026-10-01T20:00:00Z",
      p_new_ends_at: "2026-10-01T22:00:00Z",
      p_admin_id: "admin1",
      p_reason: "선생님 확인",
    });
  });

  it("RPC가 실패하면(재검증 실패 포함) 에러를 그대로 던진다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "teacher_buffer_violation" } });
    const { acceptGoogleTimeForReservation } = await import("./external-change-resolution");
    await expect(
      acceptGoogleTimeForReservation({
        reservationId: "r1", googleStartsAt: "2026-10-01T20:00:00Z", googleEndsAt: "2026-10-01T22:00:00Z",
        adminId: "admin1", reason: "x",
      })
    ).rejects.toThrow("teacher_buffer_violation");
  });
});

describe("restoreGoogleEventToAltonTime", () => {
  it("patchCalendarEventTime을 ALTON 시간으로 호출한 뒤 감사 이력 RPC를 호출한다", async () => {
    const { restoreGoogleEventToAltonTime } = await import("./external-change-resolution");
    await restoreGoogleEventToAltonTime({
      reservationId: "r1",
      teacherWorkspaceEmail: "teacher1@alton.education",
      googleEventId: "g1",
      altonStartsAt: "2026-10-01T19:00:00Z",
      altonEndsAt: "2026-10-01T21:00:00Z",
      timezone: "America/Los_Angeles",
      adminId: "admin1",
      reason: "ALTON 기준 유지",
    });
    expect(patchCalendarEventTimeMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "teacher1@alton.education",
      googleEventId: "g1",
      startsAt: new Date("2026-10-01T19:00:00Z"),
      endsAt: new Date("2026-10-01T21:00:00Z"),
      timezone: "America/Los_Angeles",
    });
    expect(rpcMock).toHaveBeenCalledWith("record_reservation_restored_to_alton_time", {
      p_reservation_id: "r1",
      p_admin_id: "admin1",
      p_reason: "ALTON 기준 유지",
    });
  });

  it("Calendar 패치가 실패하면 감사 이력 RPC는 호출하지 않는다(부분 상태 방지)", async () => {
    patchCalendarEventTimeMock.mockRejectedValue(new Error("Calendar API 요청 실패"));
    const { restoreGoogleEventToAltonTime } = await import("./external-change-resolution");
    await expect(
      restoreGoogleEventToAltonTime({
        reservationId: "r1", teacherWorkspaceEmail: "teacher1@alton.education", googleEventId: "g1",
        altonStartsAt: "2026-10-01T19:00:00Z", altonEndsAt: "2026-10-01T21:00:00Z",
        timezone: "America/Los_Angeles", adminId: "admin1", reason: "x",
      })
    ).rejects.toThrow("Calendar API 요청 실패");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("recreateCalendarEventAfterDeletion", () => {
  it("google_sync_status를 pending으로 되돌리고 옛 이벤트 정보를 지운 뒤 재동기화하고 감사 이력을 남긴다", async () => {
    const { recreateCalendarEventAfterDeletion } = await import("./external-change-resolution");
    await recreateCalendarEventAfterDeletion({ reservationId: "r1", adminId: "admin1", reason: "선생님 삭제 확인 후 재생성" });

    expect(updatePayloads[0]).toEqual({
      google_sync_status: "pending",
      google_event_id: null,
      google_meet_link: null,
      google_meeting_code: null,
    });
    expect(syncOneReservationCalendarEventMock).toHaveBeenCalledWith("r1");
    expect(rpcMock).toHaveBeenCalledWith("record_reservation_recreated_after_deletion", {
      p_reservation_id: "r1",
      p_admin_id: "admin1",
      p_reason: "선생님 삭제 확인 후 재생성",
    });
  });

  it("재생성 자체가 실패하면 예외를 던지고 감사 이력 RPC는 호출하지 않는다", async () => {
    syncOneReservationCalendarEventMock.mockResolvedValue({ outcome: "failed", error: "Calendar API 요청 실패" });
    const { recreateCalendarEventAfterDeletion } = await import("./external-change-resolution");
    await expect(
      recreateCalendarEventAfterDeletion({ reservationId: "r1", adminId: "admin1", reason: "x" })
    ).rejects.toThrow("Calendar 이벤트 재생성 실패");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
