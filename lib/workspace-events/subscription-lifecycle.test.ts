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

const getWorkspaceUserByEmailMock = vi.fn();
vi.mock("@/lib/google-workspace-directory-readonly", () => ({
  getWorkspaceUserByEmail: (email: string) => getWorkspaceUserByEmailMock(email),
}));

const VALID_TOPIC = "projects/alton-integration-sandbox/topics/workspace-events";

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
  process.env.WORKSPACE_EVENTS_PUBSUB_TOPIC = VALID_TOPIC;
  getWorkspaceUserByEmailMock.mockResolvedValue({ googleUserId: "108123456789012345678", primaryEmail: "official@alton.education", suspended: false, orgUnitPath: "/" });
});

describe("ensureSubscriptionForOrganizer", () => {
  it("구독이 없으면 새로 만들고 active로 저장한다", async () => {
    createSubMock.mockResolvedValue({ name: "subscriptions/sub-1", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    expect(result).toEqual({ organizerEmail: "official@alton.education", status: "active", action: "created" });
    expect(insertPayloads[0]).toMatchObject({ status: "active", subscription_name: "subscriptions/sub-1", organizer_workspace_user_id: "108123456789012345678" });
  });

  // 요구사항 4(2026-09-03, 같은 날 네 번째 후속) — 회귀 차단 테스트
  it("[회귀 차단] organizer 이메일을 그대로 사용자 ID로 넣지 않는다 — Directory API로 resolve한 불변 ID만 쓴다", async () => {
    createSubMock.mockResolvedValue({ name: "subscriptions/sub-1", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    expect(getWorkspaceUserByEmailMock).toHaveBeenCalledWith("official@alton.education");
    expect(createSubMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizerWorkspaceUserId: "108123456789012345678" })
    );
    const call = createSubMock.mock.calls[0][0];
    expect(call.organizerWorkspaceUserId).not.toBe("official@alton.education");
  });

  it("[회귀 차단] 웹훅 URL을 pubsubTopic으로 쓰지 않는다 — 실제 Pub/Sub 토픽 리소스 이름만 전달한다", async () => {
    createSubMock.mockResolvedValue({ name: "subscriptions/sub-1", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    const call = createSubMock.mock.calls[0][0];
    expect(call.pubsubTopic).toBe(VALID_TOPIC);
    expect(call.pubsubTopic).not.toMatch(/^https?:\/\//);
    expect(call).not.toHaveProperty("webhookUrl");
  });

  it("[fail-closed] WORKSPACE_EVENTS_PUBSUB_TOPIC이 없으면 실제 API를 호출하지 않고 즉시 error로 기록한다", async () => {
    delete process.env.WORKSPACE_EVENTS_PUBSUB_TOPIC;
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    expect(result.status).toBe("error");
    expect(createSubMock).not.toHaveBeenCalled();
    expect(insertPayloads[0].last_error).toContain("WORKSPACE_EVENTS_PUBSUB_TOPIC");
  });

  it("[fail-closed] WORKSPACE_EVENTS_PUBSUB_TOPIC 형식이 웹훅 URL이면 즉시 error로 기록한다", async () => {
    process.env.WORKSPACE_EVENTS_PUBSUB_TOPIC = "http://localhost:3010/api/webhooks/workspace-events";
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    const result = await ensureSubscriptionForOrganizer("official@alton.education", "consult_organizer");

    expect(result.status).toBe("error");
    expect(createSubMock).not.toHaveBeenCalled();
  });

  it("캐시된 organizer_workspace_user_id가 있으면 Directory API를 다시 호출하지 않는다", async () => {
    subscriptionRow = {
      id: "row-1",
      organizer_email: "teacher1@alton.education",
      organizer_role: "teacher",
      subscription_name: null,
      status: "error",
      expires_at: null,
      last_error: "이전 실패",
      organizer_workspace_user_id: "999888777666555",
    };
    createSubMock.mockResolvedValue({ name: "subscriptions/sub-3", expireTime: "2026-10-08T00:00:00Z" });
    const { ensureSubscriptionForOrganizer } = await import("./subscription-lifecycle");
    await ensureSubscriptionForOrganizer("teacher1@alton.education", "teacher");

    expect(getWorkspaceUserByEmailMock).not.toHaveBeenCalled();
    expect(createSubMock).toHaveBeenCalledWith(expect.objectContaining({ organizerWorkspaceUserId: "999888777666555" }));
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
