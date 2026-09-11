import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-10(P1 성능 배치) — loadEmailById가 auth.admin.listUsers() 페이지를
// 전부 순회하던 것을, id로 auth.users를 직접 조회하는 SECURITY DEFINER RPC
// (get_emails_by_user_ids, migration 20261271000000)로 교체했다. 이 테스트는
// (1) 전체 대상 규모와 무관하게 RPC 호출이 항상 정확히 1회로 끝나는지,
// (2) 빈 배열/중복 id/존재하지 않는 id/200명 초과/대소문자 섞인 이메일에서도
// 정확히 동작하는지를 검증한다.

const rpcMock = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
  }),
}));

describe("loadEmailById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("빈 userIds는 RPC를 호출하지 않는다", async () => {
    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById([]);
    expect(result.size).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("대상이 200명을 넘어도 RPC 호출은 정확히 1회다", async () => {
    const userIds = Array.from({ length: 350 }, (_, i) => `u${i}`);
    rpcMock.mockResolvedValue({
      data: userIds.map((id) => ({ user_id: id, email: `${id}@example.com` })),
      error: null,
    });

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(userIds);

    expect(result.size).toBe(350);
    expect(result.get("u0")).toBe("u0@example.com");
    expect(result.get("u349")).toBe("u349@example.com");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("get_emails_by_user_ids", { p_user_ids: userIds });
  });

  it("중복 id를 넘겨도 RPC에는 그대로 전달하고, 결과 맵은 id당 한 번만 저장된다", async () => {
    rpcMock.mockResolvedValue({
      data: [{ user_id: "dup1", email: "dup1@example.com" }],
      error: null,
    });

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(["dup1", "dup1", "dup1"]);

    expect(result.size).toBe(1);
    expect(result.get("dup1")).toBe("dup1@example.com");
    expect(rpcMock).toHaveBeenCalledWith("get_emails_by_user_ids", {
      p_user_ids: ["dup1", "dup1", "dup1"],
    });
  });

  it("존재하지 않는 id는 결과 맵에 아예 나타나지 않는다", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(["not-found"]);

    expect(result.size).toBe(0);
    expect(result.has("not-found")).toBe(false);
  });

  it("대소문자가 섞인 이메일도 그대로(변형 없이) 보존한다", async () => {
    rpcMock.mockResolvedValue({
      data: [{ user_id: "mixed1", email: "MixedCase.User@Example.COM" }],
      error: null,
    });

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(["mixed1"]);

    expect(result.get("mixed1")).toBe("MixedCase.User@Example.COM");
  });

  it("RPC가 에러를 반환하면 던진다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "권한 없음" } });

    const { loadEmailById } = await import("./users-data");
    await expect(loadEmailById(["u1"])).rejects.toThrow("권한 없음");
  });
});
