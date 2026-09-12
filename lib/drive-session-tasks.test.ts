import { beforeEach, describe, expect, it, vi } from "vitest";

// R8 6/N — Gate C GW-12 인수 기준: 잘못된 fileId 등 Drive API 실패가 실제로
// manual_review/reconciliation_needed 큐에 적재되고, 재처리 배치가 이를 정상
// 처리하는지 확인한다. lib/drive-artifacts.test.ts와 동일하게 fetch/Supabase
// admin client를 전부 모킹하고, 실제 네트워크 호출은 절대 없다.

const getDriveApiAccessTokenMock = vi.fn().mockResolvedValue("drive-token");
vi.mock("@/lib/google-workspace-auth", () => ({
  getDriveApiAccessToken: getDriveApiAccessTokenMock,
}));

const selectEqMock = vi.fn();
const claimEqEqSelectMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const requeueInInSelectMock = vi.fn();
const finalUpdatePayloads: Record<string, unknown>[] = [];

const fromMock = vi.fn((table: string) => {
  if (table !== "session_drive_tasks") throw new Error(`unexpected table: ${table}`);
  return {
    select: () => ({ eq: selectEqMock }),
    update: (payload: Record<string, unknown>) => {
      if (payload.status === "processing") {
        return { eq: () => ({ eq: () => ({ select: claimEqEqSelectMock }) }) };
      }
      if (payload.status === "queued") {
        // requeueSessionDriveTasks: .update().in(id).in(status).select()
        return { in: () => ({ in: () => ({ select: requeueInInSelectMock }) }) };
      }
      finalUpdatePayloads.push(payload);
      return { eq: updateEqMock };
    },
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES;
  updateEqMock.mockResolvedValue({ error: null });
  finalUpdatePayloads.length = 0;
});

describe("processQueuedSessionDriveTasks", () => {
  it("잘못된 fileId(404) 응답은 재시도 없이 즉시 reconciliation_needed로 적재한다", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        {
          id: "task1",
          session_id: "s1",
          task_type: "permission_grant",
          payload: { folderId: "bad-folder-id", teacherEmail: "t@example.com" },
          retry_count: 0,
        },
      ],
      error: null,
    });
    claimEqEqSelectMock.mockResolvedValue({ data: [{ id: "task1" }], error: null });
    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "File not found: bad-folder-id",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { processQueuedSessionDriveTasks } = await import("./drive-session-tasks");
    const result = await processQueuedSessionDriveTasks();

    expect(result).toEqual({
      attempted: 1,
      succeeded: 0,
      retryableFailed: 0,
      manualReview: 0,
      reconciliationNeeded: 1,
      skippedRace: 0,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "task1");
    const finalPayload = finalUpdatePayloads.find((p) => p.status === "reconciliation_needed");
    expect(finalPayload).toBeDefined();
  });

  it("일시적 실패는 retry_count를 늘리고 retryable_failed로, 한도(5) 초과 시 manual_review로 전이한다", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        {
          id: "task2",
          session_id: "s1",
          task_type: "folder_provision",
          payload: { studentName: "학생A", subjectName: "수학", year: "2026" },
          retry_count: 5,
        },
      ],
      error: null,
    });
    claimEqEqSelectMock.mockResolvedValue({ data: [{ id: "task2" }], error: null });
    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });
    vi.stubGlobal("fetch", fetchMock);

    const { processQueuedSessionDriveTasks } = await import("./drive-session-tasks");
    const result = await processQueuedSessionDriveTasks();

    expect(result).toEqual({
      attempted: 1,
      succeeded: 0,
      retryableFailed: 0,
      manualReview: 1,
      reconciliationNeeded: 0,
      skippedRace: 0,
    });
  });

  it("claim 경쟁 시 이미 다른 워커가 가져간 행은 건너뛴다", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "task3", session_id: "s1", task_type: "folder_provision", payload: {}, retry_count: 0 }],
      error: null,
    });
    claimEqEqSelectMock.mockResolvedValue({ data: [], error: null });

    const { processQueuedSessionDriveTasks } = await import("./drive-session-tasks");
    const result = await processQueuedSessionDriveTasks();

    expect(result.skippedRace).toBe(1);
    expect(getDriveApiAccessTokenMock).not.toHaveBeenCalled();
  });

  it("DRIVE_ARTIFACTS_ALLOW_REAL_WRITES가 꺼져 있으면 재시도 가능한 실패로 처리한다(실제 호출 없음)", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "task4", session_id: "s1", task_type: "folder_provision", payload: {}, retry_count: 0 }],
      error: null,
    });
    claimEqEqSelectMock.mockResolvedValue({ data: [{ id: "task4" }], error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { processQueuedSessionDriveTasks } = await import("./drive-session-tasks");
    const result = await processQueuedSessionDriveTasks();

    expect(result.retryableFailed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("requeueSessionDriveTasks — 재처리 배치", () => {
  it("manual_review/reconciliation_needed 작업을 queued로 되돌린다", async () => {
    requeueInInSelectMock.mockResolvedValue({ data: [{ id: "task1" }, { id: "task2" }], error: null });

    const { requeueSessionDriveTasks } = await import("./drive-session-tasks");
    const count = await requeueSessionDriveTasks(["task1", "task2"]);

    expect(count).toBe(2);
  });

  it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
    const { requeueSessionDriveTasks } = await import("./drive-session-tasks");
    const count = await requeueSessionDriveTasks([]);
    expect(count).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("재처리 후 processQueuedSessionDriveTasks를 다시 호출하면 정상 처리(succeeded)된다", async () => {
    // 1) reconciliation_needed였던 작업을 requeue
    requeueInInSelectMock.mockResolvedValue({ data: [{ id: "task1" }], error: null });
    const { requeueSessionDriveTasks, processQueuedSessionDriveTasks } = await import(
      "./drive-session-tasks"
    );
    const requeued = await requeueSessionDriveTasks(["task1"]);
    expect(requeued).toBe(1);

    // 2) 이번엔 올바른 folderId로 재처리 배치를 돌리면 성공한다.
    selectEqMock.mockResolvedValue({
      data: [
        {
          id: "task1",
          session_id: "s1",
          task_type: "permission_grant",
          payload: { folderId: "good-folder-id", teacherEmail: "t@example.com" },
          retry_count: 1,
        },
      ],
      error: null,
    });
    claimEqEqSelectMock.mockResolvedValue({ data: [{ id: "task1" }], error: null });
    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }));

    const result = await processQueuedSessionDriveTasks();
    expect(result.succeeded).toBe(1);
    expect(result.reconciliationNeeded).toBe(0);
  });
});
