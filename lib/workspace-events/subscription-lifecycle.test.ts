import { beforeEach, describe, expect, it, vi } from "vitest";

// M1/R6 공통 blocker(2026-09-03) — Workspace Events 구독 수명주기 오케스트레이션 검증.
// 실제 Google API는 모킹 — 여기서는 생성·재사용(멱등)·갱신·정지·재생성·사후 대조
// 로직만 검증한다.

const createSubMock = vi.fn();
const renewSubMock = vi.fn();
const deleteSubMock = vi.fn();
vi.mock("@/lib/google-workspace-events-subscriptions", () => ({
  createWorkspaceEventsSubscription: (p: unknown) => createSubMock(p),
  renewWorkspaceEventsSubscription: (p: unknown) => renewSubMock(p),
  deleteWorkspaceEventsSubscription: (p: unknown) => deleteSubMock(p),
}));

const findSmartNoteMock = vi.fn();
vi.mock("@/lib/google-meet", () => ({
  findRecentSmartNoteForMeetingCode: (p: unknown) => findSmartNoteMock(p),
}));

let subscriptionRow: Record<string, unknown> | null = null;
const updatePayloads: Array<Record<string, unknown>> = [];
const insertPayloads: Array<Record<string, unknown>> = [];
let consultCandidates: Array<Record<string, unknown>> = [];
let renewCandidates: Array<Record<string, unknown>> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromMock = vi.fn((table: string): any => {
  if (table === "workspace_events_subscriptions") {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: subscriptionRow, error: null }) }),
        neq: () => ({ lte: async () => ({ data: renewCandidates, error: null }) }),
      }),
      update: (payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        return { eq: async () => ({ error: null }) };
      },
      insert: (payload: Record<string, unknown>) => {
        insertPayloads.push(payload);
        return Promise.resolve({ error: null });
      },
    };
  }
  if (table === "consultations") {
    return {
      select: () => ({
        is: () => ({
          not: () => ({
            lt: () => ({ in: async () => ({ data: consultCandidates, error: null }) }),
          }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ from: fromMock }) }));

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionRow = null;
  updatePayloads.length = 0;
  insertPayloads.length = 0;
  consultCandidates = [];
  renewCandidates = [];
});

describe("ensureSubscriptionForOrganizer", () => {
  it("구독이 없으면 새로 만들고 active로 저장한다", async () => {
    createSubMock.mockResolvedValue({ name: "subscriptions/sub-1", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    expect(result).toEqual({ organizerEmail: "official@alton.education", status: "active", action: "created" });
    expect(insertPayloads[0]).toMatchObject({ status: "active", subscription_name: "subscriptions/sub-1" });
  });

  it("이미 충분히 유효한(만료 임박 아닌) 구독은 재사용하고 API를 다시 호출하지 않는다", async () => {
    subscriptionRow = {
      id: "row-1",
      organizer_email: "teacher1@alton.education",
      organizer_role: "teacher",
      subscription_name: "subscriptions/sub-1",
      status: "active",
      expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      last_error: null,
    };
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("teacher1@alton.education", "teacher");

    expect(result.action).toBe("reused");
    expect(createSubMock).not.toHaveBeenCalled();
    expect(renewSubMock).not.toHaveBeenCalled();
  });

  it("만료 임박이면 갱신하고 active로 갱신한다(중복 구독 생성 안 함)", async () => {
    subscriptionRow = {
      id: "row-1",
      organizer_email: "teacher1@alton.education",
      organizer_role: "teacher",
      subscription_name: "subscriptions/sub-1",
      status: "active",
      expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1시간 후 만료
      last_error: null,
    };
    renewSubMock.mockResolvedValue({ name: "subscriptions/sub-1", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("teacher1@alton.education", "teacher");

    expect(result.action).toBe("renewed");
    expect(renewSubMock).toHaveBeenCalledWith({ organizerEmail: "teacher1@alton.education", subscriptionName: "subscriptions/sub-1", ttlSeconds: expect.any(Number) });
    expect(createSubMock).not.toHaveBeenCalled();
  });

  it("만료/오류 상태면 재생성을 시도한다", async () => {
    subscriptionRow = {
      id: "row-1",
      organizer_email: "teacher1@alton.education",
      organizer_role: "teacher",
      subscription_name: "subscriptions/sub-old",
      status: "error",
      expires_at: null,
      last_error: "이전 실패",
    };
    createSubMock.mockResolvedValue({ name: "subscriptions/sub-2", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("teacher1@alton.education", "teacher");

    expect(result.action).toBe("recreated");
    expect(updatePayloads.find((p) => p.subscription_name === "subscriptions/sub-2")).toBeTruthy();
  });

  it("disabled 상태는 자동으로 다시 켜지 않는다", async () => {
    subscriptionRow = {
      id: "row-1",
      organizer_email: "teacher1@alton.education",
      organizer_role: "teacher",
      subscription_name: null,
      status: "disabled",
      expires_at: null,
      last_error: "관리자 정지",
    };
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("teacher1@alton.education", "teacher");

    expect(result).toEqual({ organizerEmail: "teacher1@alton.education", status: "disabled", action: "skipped_disabled" });
    expect(createSubMock).not.toHaveBeenCalled();
  });

  it("API 호출이 실패해도 예외를 던지지 않고 error 상태로 기록한다(best-effort)", async () => {
    createSubMock.mockRejectedValue(new Error("not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면..."));
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    expect(result.status).toBe("error");
    expect(insertPayloads[0]).toMatchObject({ status: "error" });
  });
});

describe("disableSubscriptionForOrganizer", () => {
  it("존재하는 구독을 삭제하고 disabled로 기록한다", async () => {
    subscriptionRow = { id: "row-1", subscription_name: "subscriptions/sub-1" };
    deleteSubMock.mockResolvedValue(undefined);
    const { disableSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    await disableSubscriptionForOrganizer("teacher1@alton.education", "선생님 계정 정지");

    expect(deleteSubMock).toHaveBeenCalledWith({ organizerEmail: "teacher1@alton.education", subscriptionName: "subscriptions/sub-1" });
    expect(updatePayloads[0]).toMatchObject({ status: "disabled" });
  });
});

describe("reconcileMissedSmartNotesEvents", () => {
  it("Smart Notes가 아직 연결 안 된 지난 상담을 Meet API로 재대조해 연결한다", async () => {
    consultCandidates = [{ id: "consult-1", google_meeting_code: "abc-defg-hij" }];
    findSmartNoteMock.mockResolvedValue({ smartNoteResourceName: "conferenceRecords/x/smartNotes/y", driveFileId: "drive-1" });

    const { reconcileMissedSmartNotesEvents } = await import("./subscription-lifecycle");
    const result = await reconcileMissedSmartNotesEvents();

    expect(result).toEqual({ checked: 1, relinked: 1 });
  });

  it("찾지 못해도 유실 처리하지 않고 다음 재처리 대상으로 남긴다(예외 없이 계속)", async () => {
    consultCandidates = [{ id: "consult-1", google_meeting_code: "abc-defg-hij" }];
    findSmartNoteMock.mockResolvedValue(null);

    const { reconcileMissedSmartNotesEvents } = await import("./subscription-lifecycle");
    const result = await reconcileMissedSmartNotesEvents();

    expect(result).toEqual({ checked: 1, relinked: 0 });
  });
});
