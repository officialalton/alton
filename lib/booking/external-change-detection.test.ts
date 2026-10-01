import { beforeEach, describe, expect, it, vi } from "vitest";

const listCalendarEventsIncrementalMock = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  listCalendarEventsIncremental: (params: unknown) => listCalendarEventsIncrementalMock(params),
}));

const teacherLookupMock = vi.fn();
const syncStateLookupMock = vi.fn();
const syncStateUpsertMock = vi.fn().mockResolvedValue({ error: null });
const reservationLookupMock = vi.fn();
const reservationUpdateFinalMock = vi.fn().mockResolvedValue({ error: null });
const updatePayloads: Array<Record<string, unknown>> = [];

const fromMock = vi.fn((table: string) => {
  if (table === "teachers") {
    return { select: () => ({ eq: () => ({ single: teacherLookupMock }) }) };
  }
  if (table === "teacher_calendar_sync_state") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: syncStateLookupMock }) }),
      upsert: (payload: unknown) => syncStateUpsertMock(payload),
    };
  }
  if (table === "reservations") {
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: reservationLookupMock }), maybeSingle: reservationLookupMock }),
      }),
      update: (payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        return { eq: () => ({ eq: reservationUpdateFinalMock }) };
      },
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const BASE_RESERVATION = {
  id: "r1",
  starts_at: "2026-10-01T19:00:00.000Z",
  ends_at: "2026-10-01T21:00:00.000Z",
  google_event_id: "g1",
  google_meet_link: "https://meet.google.com/abc-defg-hij",
  status: "confirmed",
};

beforeEach(() => {
  vi.clearAllMocks();
  updatePayloads.length = 0;
  teacherLookupMock.mockResolvedValue({ data: { workspace_email: "teacher1@alton.education" }, error: null });
  syncStateLookupMock.mockResolvedValue({ data: null });
  reservationLookupMock.mockResolvedValue({ data: { ...BASE_RESERVATION } });
  syncStateUpsertMock.mockResolvedValue({ error: null });
});

describe("reconcileTeacherCalendarChanges", () => {
  it("workspace_email이 없으면 checked:false를 반환하고 Google을 호출하지 않는다", async () => {
    teacherLookupMock.mockResolvedValue({ data: { workspace_email: null }, error: null });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result).toEqual({ checked: false, changesDetected: 0, error: "workspace_email이 없습니다." });
    expect(listCalendarEventsIncrementalMock).not.toHaveBeenCalled();
  });

  it("변경이 없으면 changesDetected:0이고 external_change_status를 건드리지 않는다", async () => {
    listCalendarEventsIncrementalMock.mockResolvedValue({
      events: [
        {
          googleEventId: "g1",
          status: "confirmed",
          altonReservationId: "r1",
          startsAt: BASE_RESERVATION.starts_at,
          endsAt: BASE_RESERVATION.ends_at,
          meetLink: BASE_RESERVATION.google_meet_link,
        },
      ],
      nextSyncToken: "token2",
      syncTokenExpired: false,
    });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result).toEqual({ checked: true, changesDetected: 0 });
    expect(updatePayloads).toEqual([]);
  });

  it("Google에서 시간이 바뀌면 time_changed로 표시하고 예약/세션 자체는 건드리지 않는다", async () => {
    listCalendarEventsIncrementalMock.mockResolvedValue({
      events: [
        {
          googleEventId: "g1",
          status: "confirmed",
          altonReservationId: "r1",
          startsAt: "2026-10-01T20:00:00.000Z",
          endsAt: "2026-10-01T22:00:00.000Z",
          meetLink: BASE_RESERVATION.google_meet_link,
        },
      ],
      nextSyncToken: "token2",
      syncTokenExpired: false,
    });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result).toEqual({ checked: true, changesDetected: 1 });
    expect(updatePayloads[0]).toMatchObject({ external_change_status: "time_changed" });
  });

  it("Google에서 이벤트가 삭제되면 deleted로 표시한다(예약은 자동 취소하지 않음)", async () => {
    listCalendarEventsIncrementalMock.mockResolvedValue({
      events: [{ googleEventId: "g1", status: "cancelled", altonReservationId: "r1", startsAt: null, endsAt: null, meetLink: null }],
      nextSyncToken: "token2",
      syncTokenExpired: false,
    });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result.changesDetected).toBe(1);
    expect(updatePayloads[0]).toMatchObject({ external_change_status: "deleted" });
  });

  it("Google이 삭제된 이벤트의 extendedProperties를 비워도(altonReservationId 없음) googleEventId로 대조해 감지한다(R6 Sandbox 실측 2026-09-03 발견)", async () => {
    listCalendarEventsIncrementalMock.mockResolvedValue({
      events: [{ googleEventId: "g1", status: "cancelled", altonReservationId: null, startsAt: null, endsAt: null, meetLink: null }],
      nextSyncToken: "token2",
      syncTokenExpired: false,
    });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result.changesDetected).toBe(1);
    expect(updatePayloads[0]).toMatchObject({ external_change_status: "deleted" });
  });

  it("Meet 링크만 바뀌면 meet_link_changed로 표시한다(자동 수용 안 함)", async () => {
    listCalendarEventsIncrementalMock.mockResolvedValue({
      events: [
        {
          googleEventId: "g1",
          status: "confirmed",
          altonReservationId: "r1",
          startsAt: BASE_RESERVATION.starts_at,
          endsAt: BASE_RESERVATION.ends_at,
          meetLink: "https://meet.google.com/zzz-zzzz-zzz",
        },
      ],
      nextSyncToken: "token2",
      syncTokenExpired: false,
    });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result.changesDetected).toBe(1);
    expect(updatePayloads[0]).toMatchObject({ external_change_status: "meet_link_changed" });
  });

  it("sync token이 만료되면 전체 재동기화로 폴백한다", async () => {
    syncStateLookupMock.mockResolvedValue({ data: { sync_token: "stale-token" } });
    listCalendarEventsIncrementalMock
      .mockResolvedValueOnce({ events: [], nextSyncToken: "", syncTokenExpired: true })
      .mockResolvedValueOnce({ events: [], nextSyncToken: "fresh-token", syncTokenExpired: false });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result).toEqual({ checked: true, changesDetected: 0 });
    expect(listCalendarEventsIncrementalMock).toHaveBeenCalledTimes(2);
    expect(listCalendarEventsIncrementalMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ syncToken: "stale-token" }));
    expect(listCalendarEventsIncrementalMock).toHaveBeenNthCalledWith(2, { teacherWorkspaceEmail: "teacher1@alton.education" });
  });

  it("Google 호출 자체가 실패해도 checked:false로 조용히 반환한다(다른 업무를 막지 않음)", async () => {
    listCalendarEventsIncrementalMock.mockRejectedValue(new Error("not implemented: ..."));
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    const result = await reconcileTeacherCalendarChanges("t1");
    expect(result.checked).toBe(false);
    expect(result.error).toContain("not implemented");
  });

  it("이미 관리자 확인 대기 중인 예약은 새 변경으로 덮어쓰지 않는다(SQL where절로 방어 — 여기선 호출 인자만 검증)", async () => {
    listCalendarEventsIncrementalMock.mockResolvedValue({
      events: [
        {
          googleEventId: "g1",
          status: "cancelled",
          altonReservationId: "r1",
          startsAt: null,
          endsAt: null,
          meetLink: null,
        },
      ],
      nextSyncToken: "token2",
      syncTokenExpired: false,
    });
    const { reconcileTeacherCalendarChanges } = await import("./external-change-detection");
    await reconcileTeacherCalendarChanges("t1");
    expect(fromMock).toHaveBeenCalledWith("reservations");
  });
});
