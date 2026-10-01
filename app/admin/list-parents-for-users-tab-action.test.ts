import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-10(P1 — 학부모 SSR 회귀 조사 후속) — listParentsForUsersTabAction()이
// 예외를 던지지 않고 항상 {ok, data} | {ok:false, errorCode}를 반환하는지,
// 그리고 RPC 실패·빈 결과·대량 id를 각각 올바르게 처리하는지 검증한다.

const getUserMock = vi.fn();
const profileSingleMock = vi.fn();
const rpcMock = vi.fn();

type Row = Record<string, unknown>;

function chain(rows: Row[]) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    not: () => builder,
    order: () => builder,
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return builder;
}

let parentsRows: Row[] = [];
let guardianLinkRows: Row[] = [];
let childLinkRows: Row[] = [];
let householdMembersCallCount = 0;

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      if (table === "parents") return chain(parentsRows);
      // P4-1(B, 2026-09-11) — loadParents()는 아카이브된 가구를 제외하기 위해
      // households를 1회 추가 조회한다. 이 스펙에는 아카이브된 가구가 없다.
      if (table === "households") return chain([]);
      if (table === "household_members") {
        // loadParents()는 household_members를 role별로 두 번 순서대로 조회한다
        // (guardian 링크 먼저, child 링크 다음) — 호출 순서에 맞춰 다른 결과를 준다.
        householdMembersCallCount += 1;
        return chain(householdMembersCallCount === 1 ? guardianLinkRows : childLinkRows);
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

describe("listParentsForUsersTabAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    parentsRows = [];
    guardianLinkRows = [];
    childLinkRows = [];
    householdMembersCallCount = 0;
  });

  it("학부모가 없으면 ok:true, 빈 배열을 돌려준다(RPC 호출 없음)", async () => {
    parentsRows = [];
    const { listParentsForUsersTabAction } = await import("./users-actions");
    const result = await listParentsForUsersTabAction();
    expect(result).toEqual({ ok: true, data: [] });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("이메일 RPC가 실패하면 예외를 던지지 않고 ok:false와 errorCode를 돌려준다", async () => {
    parentsRows = [{ id: "p1", joined_at: "2026-01-01", profile: { name: "김민지" } }];
    rpcMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const { listParentsForUsersTabAction } = await import("./users-actions");
    const result = await listParentsForUsersTabAction();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toContain("email_rpc_failed");
    }
  });

  it("대상이 많아도(대량 id) RPC는 한 번만 호출되고 성공하면 목록을 돌려준다", async () => {
    parentsRows = Array.from({ length: 300 }, (_, i) => ({
      id: `p${i}`,
      joined_at: "2026-01-01",
      profile: { name: `학부모${i}` },
    }));
    rpcMock.mockResolvedValue({
      data: parentsRows.map((p) => ({ user_id: p.id, email: `${p.id}@example.com` })),
      error: null,
    });

    const { listParentsForUsersTabAction } = await import("./users-actions");
    const result = await listParentsForUsersTabAction();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(300);
      expect(result.data[0].email).toBe("p0@example.com");
    }
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
