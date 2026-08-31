import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const rpcMock = vi.fn();
const deleteUserMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: deleteUserMock } },
  }),
}));

describe("mergeAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("merge_accounts RPC를 호출한다", async () => {
    const { mergeAccounts } = await import("./merge-actions");
    await mergeAccounts({ survivorId: "s1", mergedId: "m1", reason: "중복 계정" });

    expect(rpcMock).toHaveBeenCalledWith("merge_accounts", {
      p_survivor_id: "s1",
      p_merged_id: "m1",
      p_reason: "중복 계정",
    });
  });

  it("사유가 비어 있으면 RPC 호출 전에 거부한다", async () => {
    const { mergeAccounts } = await import("./merge-actions");

    await expect(
      mergeAccounts({ survivorId: "s1", mergedId: "m1", reason: "   " })
    ).rejects.toThrow(/병합 사유를 입력해주세요/);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("getTeacherRateHistoryWithMerged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
  });

  it("병합 원본과 생존 계정의 시급 이력을 원래 teacher_id를 보존한 채 함께 반환한다", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          source_teacher_id: "merged1",
          amount_minor: 38000,
          currency: "KRW",
          effective_from: "2026-08-01T00:00:00Z",
          effective_until: null,
          created_by: "admin1",
          created_at: "2026-08-01T00:00:00Z",
        },
        {
          source_teacher_id: "survivor1",
          amount_minor: 50000,
          currency: "KRW",
          effective_from: "2026-08-20T00:00:00Z",
          effective_until: null,
          created_by: null,
          created_at: "2026-08-20T00:00:00Z",
        },
      ],
      error: null,
    });

    const { getTeacherRateHistoryWithMerged } = await import("./merge-actions");
    const result = await getTeacherRateHistoryWithMerged("survivor1");

    expect(rpcMock).toHaveBeenCalledWith("teacher_rate_history_with_merged", {
      p_teacher_id: "survivor1",
    });
    expect(result).toEqual([
      {
        sourceTeacherId: "merged1",
        amountMinor: 38000,
        currency: "KRW",
        effectiveFrom: "2026-08-01T00:00:00Z",
        effectiveUntil: null,
        createdBy: "admin1",
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        sourceTeacherId: "survivor1",
        amountMinor: 50000,
        currency: "KRW",
        effectiveFrom: "2026-08-20T00:00:00Z",
        effectiveUntil: null,
        createdBy: null,
        createdAt: "2026-08-20T00:00:00Z",
      },
    ]);
  });
});

describe("anonymizeMergedAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ error: null });
    deleteUserMock.mockResolvedValue({ error: null });
  });

  it("PII 스크럽 RPC 성공 후 Auth 계정을 삭제한다", async () => {
    const { anonymizeMergedAccount } = await import("./merge-actions");
    await anonymizeMergedAccount("m1");

    expect(rpcMock).toHaveBeenCalledWith("anonymize_merged_account", { p_profile_id: "m1" });
    expect(deleteUserMock).toHaveBeenCalledWith("m1");
  });

  it("RPC가 실패하면 Auth 계정 삭제를 시도하지 않는다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "병합 후 30일이 지나야 익명화할 수 있습니다." } });
    const { anonymizeMergedAccount } = await import("./merge-actions");

    await expect(anonymizeMergedAccount("m1")).rejects.toThrow(/30일이 지나야/);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("이미 삭제된 Auth 계정(not found)은 에러로 취급하지 않는다", async () => {
    deleteUserMock.mockResolvedValue({ error: { message: "User not found" } });
    const { anonymizeMergedAccount } = await import("./merge-actions");

    await expect(anonymizeMergedAccount("m1")).resolves.toBeUndefined();
  });
});
