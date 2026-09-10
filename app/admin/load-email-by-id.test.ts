import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-10(P1 정확성 수정) — loadEmailById가 첫 페이지(perPage: 200)만
// 읽어서 전체 Auth 사용자가 200명을 넘으면 뒤쪽 페이지의 이메일이 조용히
// 누락되던 문제를 고쳤다. 이 테스트는 여러 페이지에 걸쳐 대상 userIds를
// 찾아내는지, 그리고 더 이상 페이지가 없으면(마지막 페이지 길이 <
// perPage) 순회를 멈추는지를 검증한다.

const listUsersMock = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { listUsers: listUsersMock } },
  }),
}));

function page(users: { id: string; email: string }[]) {
  return { data: { users }, error: null };
}

describe("loadEmailById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("빈 userIds는 Auth를 호출하지 않는다", async () => {
    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById([]);
    expect(result.size).toBe(0);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("대상이 두 번째 페이지에 있어도 끝까지 순회해 찾아낸다", async () => {
    const page1Users = Array.from({ length: 200 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@example.com`,
    }));
    const page2Users = [{ id: "target-1", email: "target1@example.com" }];

    listUsersMock.mockImplementation(({ page: p }: { page: number }) =>
      Promise.resolve(p === 1 ? page(page1Users) : page(page2Users))
    );

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(["u5", "target-1"]);

    expect(result.get("u5")).toBe("u5@example.com");
    expect(result.get("target-1")).toBe("target1@example.com");
    expect(listUsersMock).toHaveBeenCalledTimes(2);
  });

  it("마지막 페이지(perPage 미만)에서 순회를 멈춘다", async () => {
    listUsersMock.mockImplementation(({ page: p }: { page: number }) =>
      Promise.resolve(
        p === 1
          ? page([{ id: "a", email: "a@example.com" }])
          : page([])
      )
    );

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(["not-found"]);

    expect(result.size).toBe(0);
    expect(listUsersMock).toHaveBeenCalledTimes(1);
  });

  it("모든 대상을 첫 페이지에서 다 찾으면 더 이상 페이지를 요청하지 않는다", async () => {
    listUsersMock.mockImplementation(() =>
      Promise.resolve(
        page(
          Array.from({ length: 200 }, (_, i) => ({
            id: `u${i}`,
            email: `u${i}@example.com`,
          }))
        )
      )
    );

    const { loadEmailById } = await import("./users-data");
    const result = await loadEmailById(["u1", "u2"]);

    expect(result.get("u1")).toBe("u1@example.com");
    expect(result.get("u2")).toBe("u2@example.com");
    expect(listUsersMock).toHaveBeenCalledTimes(1);
  });
});
