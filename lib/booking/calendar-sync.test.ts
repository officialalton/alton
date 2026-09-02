import { beforeEach, describe, expect, it, vi } from "vitest";

// R6 2/N: processPendingCalendarSyncs 큐 워커 — drive-artifacts.test.ts(R3)와 동일한
// 낙관적 잠금(조건부 UPDATE) claim 패턴, retry_count 초과 시 reconciliation_needed 전환을
// 검증한다. Calendar API 자체(lib/google-calendar)는 모킹 — 여기서는 워커 오케스트레이션만
// 검증한다.

const createCalendarEventWithMetMock = vi.fn();
const deleteCalendarEventMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  createCalendarEventWithMeet: (params: unknown) => createCalendarEventWithMetMock(params),
  deleteCalendarEvent: (params: unknown) => deleteCalendarEventMock(params),
}));

let reservationsCandidates: Array<Record<string, unknown>> = [];
let reservationsClaimResult: { data: unknown; error: unknown } = { data: [{ id: "r1" }], error: null };
const reservationsUpdateFinalMock = vi.fn().mockResolvedValue({ error: null });
const finalUpdatePayloads: Array<Record<string, unknown>> = [];
const teacherLookupMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "reservations") {
    return {
      select: () => ({
        eq: () => ({
          in: () => ({
            gt: async () => ({ data: reservationsCandidates, error: null }),
          }),
        }),
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
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  reservationsCandidates = [];
  reservationsClaimResult = { data: [{ id: "r1" }], error: null };
  reservationsUpdateFinalMock.mockResolvedValue({ error: null });
  finalUpdatePayloads.length = 0;
  teacherLookupMock.mockResolvedValue({ data: { workspace_email: "teacher@alton.education" }, error: null });
});

describe("processPendingCalendarSyncs", () => {
  it("후보가 없으면 아무 것도 하지 않는다", async () => {
    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();
    expect(result).toEqual({ attempted: 0, succeeded: 0, failed: 0, reconciliationNeeded: 0, skippedRace: 0 });
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
  });

  it("성공 시 synced로 전환하고 google_event_id/meet_link를 기록한다", async () => {
    reservationsCandidates = [
      { id: "r1", owner_profile_id: "t1", starts_at: "2026-10-01T19:00:00Z", ends_at: "2026-10-01T21:00:00Z", google_sync_retry_count: 0 },
    ];
    createCalendarEventWithMetMock.mockResolvedValue({ googleEventId: "g1", meetLink: "https://meet.google.com/x" });

    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();

    expect(result.succeeded).toBe(1);
    expect(reservationsUpdateFinalMock).toHaveBeenCalledWith("id", "r1");
  });

  it("이미 다른 워커가 claim한 행(race)은 스킵한다", async () => {
    reservationsCandidates = [
      { id: "r1", owner_profile_id: "t1", starts_at: "2026-10-01T19:00:00Z", ends_at: "2026-10-01T21:00:00Z", google_sync_retry_count: 0 },
    ];
    reservationsClaimResult = { data: [], error: null };

    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();

    expect(result.skippedRace).toBe(1);
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
  });

  it("retry_count가 MAX(5) 이하면 failed로, 초과하면 reconciliation_needed로 전환한다", async () => {
    reservationsCandidates = [
      { id: "r1", owner_profile_id: "t1", starts_at: "2026-10-01T19:00:00Z", ends_at: "2026-10-01T21:00:00Z", google_sync_retry_count: 5 },
    ];
    createCalendarEventWithMetMock.mockRejectedValue(new Error("Calendar API 요청 실패"));

    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();

    expect(result.reconciliationNeeded).toBe(1);
    expect(finalUpdatePayloads[0]).toMatchObject({ google_sync_status: "reconciliation_needed", google_sync_retry_count: 6 });
  });

  it("teacher workspace_email이 없으면 명확한 에러로 실패 처리된다", async () => {
    reservationsCandidates = [
      { id: "r1", owner_profile_id: "t1", starts_at: "2026-10-01T19:00:00Z", ends_at: "2026-10-01T21:00:00Z", google_sync_retry_count: 0 },
    ];
    teacherLookupMock.mockResolvedValue({ data: { workspace_email: null }, error: null });

    const { processPendingCalendarSyncs } = await import("./calendar-sync");
    const result = await processPendingCalendarSyncs();

    expect(result.failed).toBe(1);
    expect(createCalendarEventWithMetMock).not.toHaveBeenCalled();
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
