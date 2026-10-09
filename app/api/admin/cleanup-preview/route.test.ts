import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }));

const from = vi.fn();
const rpc = vi.fn();
const listUsers = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from, rpc, auth: { admin: { listUsers } } }),
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
  // 기본값: 이메일 조회가 아무도 찾지 못한 상태.
  rpc.mockResolvedValue({ data: [], error: null });
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
    expect(rpc).not.toHaveBeenCalled();
  });

  // 2026-09-13: 미로그인과 "로그인했지만 관리자가 아님"이 같은 403이면
  // "비관리자도 막힌다"를 확인할 방법이 없다.
  it("미로그인은 401, 로그인한 비관리자는 403으로 구분한다", async () => {
    const { GET } = await import("./route");

    requireAdmin.mockRejectedValue(new Error("로그인이 필요합니다."));
    expect((await GET()).status).toBe(401);

    requireAdmin.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    expect((await GET()).status).toBe(403);
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
    expect(body.preservedAllFound).toBe(false);
  });

  // 2026-09-13에 드러난 것: 이 경로가 auth 목록을 한 명도 읽지 못했는데 그 오류를
  // 삼키고 "found:false"로 보고했다. 조회 실패와 계정 없음은 전혀 다른 이야기이고,
  // 후자로 오해하면 보존해야 할 계정을 정리 대상에 넣게 된다.
  it("조회가 실패한 것과 계정이 없는 것을 구분해 보고한다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { GET } = await import("./route");
    const body = await (await GET()).json();

    expect(body.preservedAllFound).toBe(false);
    expect(body.lookupDiagnostics.emailLookupFailed).toBe("permission denied");
  });

  it("이메일로 찾으면 id와 역할을 함께 돌려준다", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "lookup_auth_user_ids_by_email") {
        return Promise.resolve({
          data: [{ user_id: "user-official", email: "official@alton.education" }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
    from.mockImplementation(() => ({
      select: () => chainable({ count: 0, data: [{ role: "admin" }], error: null }),
    }));

    const { GET } = await import("./route");
    const body = await (await GET()).json();

    const official = body.preserved.find(
      (p: { email: string }) => p.email === "official@alton.education"
    );
    expect(official.found).toBe(true);
    expect(official.userId).toBe("user-official");
    // 하나만 찾았으므로 정리를 시작하면 안 된다.
    expect(body.preservedAllFound).toBe(false);
  });
});
