import { beforeEach, describe, expect, it, vi } from "vitest";

// R6 2/N·10/N: syncOneReservationCalendarEvent()(단일 예약 동기화, confirmLessonBooking()
// 직후 즉시 호출과 processPendingCalendarSyncs()(배치 재처리 워커) 양쪽이 공유) —
// drive-artifacts.test.ts(R3)와 동일한 낙관적 잠금(조건부 UPDATE) claim 패턴, retry_count
// 초과 시 reconciliation_needed 전환을 검증한다. Calendar/Meet API 자체는 모킹 — 여기서는
// 오케스트레이션만 검증한다.

const createCalendarEventWithMetMock = vi.fn();
const deleteCalendarEventMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  createCalendarEventWithMeet: (params: unknown) => createCalendarEventWithMetMock(params),
  deleteCalendarEvent: (params: unknown) => deleteCalendarEventMock(params),
}));

const enableMeetSpaceSmartNotesMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/google-meet", () => ({
  extractMeetingCodeFromLink: (link: string) => {
    const m = link.match(/meet\.google\.com\/([a-z-]+)/);
    return m ? m[1] : null;
  },
  enableMeetSpaceSmartNotes: (params: unknown) => enableMeetSpaceSmartNotesMock(params),
}));

let reservationRow: Record<string, unknown> | null = null;
let reservationsCandidates: Array<{ id: string }> = [];
let reservationsClaimResult: { data: unknown; error: unknown } = { data: [{ id: "r1" }], error: null };
const reservationsUpdateFinalMock = vi.fn().mockResolvedValue({ error: null });
const finalUpdatePayloads: Array<Record<string, unknown>> = [];
const teacherLookupMock = vi.fn();
const sessionsUpdateFinalMock = vi.fn().mockResolvedValue({ error: null });
const sessionsUpdatePayloads: Array<Record<string, unknown>> = [];

const fromMock = vi.fn((table: string) => {
  if (table === "reservations") {
    return {
      select: () => ({
        eq: (col: string) => {
          if (col === "id") {
            return { maybeSingle: async () => ({ data: reservationRow, error: null }) };
          }
          // candidates list path: .eq("status","confirmed").in(...).gt(...)
          return { in: () => ({ gt: async () => ({ data: reservationsCandidates, error: null }) }) };
        },
      }),
      update: (payload: Record<string, unknown>) => {
        if (payload.google_sync_status === "pending") {
          // claim attempt: .eq(id).in(status).select('id')
          return { eq: () => ({ in: () => ({ select: async () => reservationsClaimResult }) }) };
        }
        finalUpdatePayloads.push(payload);
        return { eq: reservationsUpdateFinalMock };
      },
    };
  }
  if (table === "teachers") {
    return { select: () => ({ eq: () => ({ single: teacherLookupMock }) }) };
  }
  if (table === "sessions") {
    return {
      update: (payload: Record<string, unknown>) => {
        sessionsUpdatePayloads.push(payload);
        return { eq: sessionsUpdateFinalMock };
      },
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const BASE_ROW = {
  id: "r1",
  owner_profile_id: "t1",
  starts_at: "2026-10-01T19:00:00Z",
  ends_at: "2026-10-01T21:00:00Z",
  google_sync_retry_count: 0,
  google_sync_status: "pending",
};

beforeEach(() => {
  vi.clearAllMocks();
  reservationRow = { ...BASE_ROW };
  reservationsCandidates = [];
  reservationsClaimResult = { data: [{ id: "r1" }], error: null };
  reservationsUpdateFinalMock.mockResolvedValue({ error: null });
  finalUpdatePayloads.length = 0;
  sessionsUpdatePayloads.length = 0;
  teacherLookupMock.mockResolvedValue({ data: { workspace_email: "teacher@alton.education" }, error: null });
  sessionsUpdateFinalMock.mockResolvedValue({ error: null });
  enableMeetSpaceSmartNotesMock.mockResolvedValue(undefined);
});

describe("syncOneReservationCalendarEvent", () => {
  it("이미 synced/reconciliation_needed 상태면 스킵한다", async () => {
    reservationRow = { ...BASE_ROW, google_sync_status: "synced" };
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    const result = await syncOneReservationCalendarEvent("r1");
    expect(result).toEqual({ outcome: "skipped_not_pending" });
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
  });

  it("성공 시 synced로 전환하고 google_event_id/meet_link/meeting_code를 기록한다", async () => {
    createCalendarEventWithMetMock.mockResolvedValue({ googleEventId: "g1", meetLink: "https://meet.google.com/abc-defg-hij" });
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    const result = await syncOneReservationCalendarEvent("r1");

    expect(result).toEqual({ outcome: "synced", googleEventId: "g1", meetLink: "https://meet.google.com/abc-defg-hij" });
    expect(finalUpdatePayloads[0]).toMatchObject({
      google_sync_status: "synced",
      google_event_id: "g1",
      google_meet_link: "https://meet.google.com/abc-defg-hij",
      google_meeting_code: "abc-defg-hij",
    });
  });

  it("정규수업은 가족계약 필수 조항이므로 항상 Smart Notes를 켠다(회차별 선택 없음)", async () => {
    createCalendarEventWithMetMock.mockResolvedValue({ googleEventId: "g1", meetLink: "https://meet.google.com/abc-defg-hij" });
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    await syncOneReservationCalendarEvent("r1");
    expect(enableMeetSpaceSmartNotesMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "teacher@alton.education",
      meetingCode: "abc-defg-hij",
    });
    expect(sessionsUpdatePayloads[0]).toMatchObject({ smart_notes_config_status: "applied", smart_notes_config_error: null });
  });

  it("Smart Notes 설정이 실패해도 Calendar 동기화 자체는 synced로 성공 처리되고, 세션은 관리자 재처리 대상(failed)으로 기록된다", async () => {
    createCalendarEventWithMetMock.mockResolvedValue({ googleEventId: "g1", meetLink: "https://meet.google.com/abc-defg-hij" });
    enableMeetSpaceSmartNotesMock.mockRejectedValue(new Error("Meet API 요청 실패"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    const result = await syncOneReservationCalendarEvent("r1");
    expect(result.outcome).toBe("synced");
    expect(sessionsUpdatePayloads[0]).toMatchObject({ smart_notes_config_status: "failed", smart_notes_config_error: "Meet API 요청 실패" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("r6_smart_notes_config_failed"));
    errorSpy.mockRestore();
  });

  it("이미 다른 워커가 claim한 행(race)은 스킵한다", async () => {
    reservationsClaimResult = { data: [], error: null };
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    const result = await syncOneReservationCalendarEvent("r1");
    expect(result).toEqual({ outcome: "skipped_race" });
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
  });

  it("retry_count가 MAX(5) 이하면 failed로, 초과하면 reconciliation_needed로 전환한다", async () => {
    reservationRow = { ...BASE_ROW, google_sync_retry_count: 5 };
    createCalendarEventWithMetMock.mockRejectedValue(new Error("Calendar API 요청 실패"));
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    const result = await syncOneReservationCalendarEvent("r1");

    expect(result.outcome).toBe("reconciliation_needed");
    expect(finalUpdatePayloads[0]).toMatchObject({ google_sync_status: "reconciliation_needed", google_sync_retry_count: 6 });
  });

  it("teacher workspace_email이 없으면 명확한 에러로 실패 처리된다", async () => {
    teacherLookupMock.mockResolvedValue({ data: { workspace_email: null }, error: null });
    const { syncOneReservationCalendarEvent } = await import("./calendar-sync");
    const result = await syncOneReservationCalendarEvent("r1");
    expect(result.outcome).toBe("failed");
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
  });
});

describe("processPendingCalendarSyncs", () => {
  it("후보가 없으면 아무 것도 하지 않는다", async () => {
    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0, reconciliationNeeded: 0, skippedRace: 0 });
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
  });

  it("후보 각각에 대해 syncOneReservationCalendarEvent를 호출하고 결과를 집계한다", async () => {
    reservationsCandidates = [{ id: "r1" }];
    createCalendarEventWithMetMock.mockResolvedValue({ googleEventId: "g1", meetLink: "https://meet.google.com/abc-defg-hij" });

    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();

    expect(result.attempted).toBe(1);
    expect(result.succeeded).toBe(1);
  });
});

describe("cancelSyncedCalendarEvent", () => {
  it("google_event_id가 없으면 아무 것도 호출하지 않는다(스킵)", async () => {
    const { cancelSyncedCalendarEvent } = await import("./calendar-sync");
    await cancelSyncedCalendarEvent({ reservationId: "r1", teacherId: "t1", googleEventId: null });
    expect(deleteCalendarEventMock).not.toHaveBeenCalled();
  });

  it("google_event_id가 있으면 선생님 workspace_email로 삭제를 호출한다", async () => {
    const { cancelSyncedCalendarEvent } = await import("./calendar-sync");
    await cancelSyncedCalendarEvent({ reservationId: "r1", teacherId: "t1", googleEventId: "g1" });
    expect(deleteCalendarEventMock).toHaveBeenCalledWith({
      teacherWorkspaceEmail: "teacher@alton.education",
      googleEventId: "g1",
    });
  });
});
