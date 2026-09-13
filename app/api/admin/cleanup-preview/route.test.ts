import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }));

const from = vi.fn();
const listUsers = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from, auth: { admin: { listUsers } } }),
}));

/** 어떤 필터 체인이든 받아 결과로 끝나는 스텁. */
function chainable(result: unknown) {
  const self: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        }
        return () => self;
      },
    }
  );
  return self;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ supabase: {}, adminUserId: "admin-1" });
  listUsers.mockResolvedValue({ data: { users: [] } });
  from.mockImplementation(() => ({
    select: () => chainable({ count: 0, data: [], error: null }),
  }));
});

describe("정리 대상 집계 경로", () => {
  it("관리자가 아니면 403이고 아무것도 조회하지 않는다", async () => {
    requireAdmin.mockRejectedValue(new Error("관리자만"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("아무것도 바꾸지 않는다 — 쓰기 호출이 없다", async () => {
    const { GET } = await import("./route");
    await GET();
    // insert/update/delete/upsert를 부르지 않는다. 이 경로는 집계 전용이다.
    const src = (await import("node:fs")).readFileSync(
      "app/api/admin/cleanup-preview/route.ts",
      "utf-8"
    );
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    expect(src).not.toContain("deleteUser");
  });

  it("보존 계정 id를 코드에 박지 않고 이메일로 찾는다", async () => {
    const src = (await import("node:fs")).readFileSync(
      "app/api/admin/cleanup-preview/route.ts",
      "utf-8"
    );
    expect(src).toContain("official@alton.education");
    expect(src).toContain("teacher1@alton.education");
    expect(src).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it("보존 계정을 못 찾으면 found:false로 드러낸다", async () => {
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.preserved).toHaveLength(2);
    expect(body.preserved.every((p: { found: boolean }) => p.found === false)).toBe(true);
  });
});
