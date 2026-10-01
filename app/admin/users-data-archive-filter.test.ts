import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-1(B) — 아카이브된 가구가 관리자 목록에서 빠지는지 검증한다.
// loadParents/loadStudents는 아카이브된 household id 집합을 왕복 1회로 읽어
// 그 가구의 보호자·자녀를 제외한다(아카이브됨 서브탭에서만 보인다).

type QueryResult = { data: unknown; error: unknown };

const { adminRpcMock } = vi.hoisted(() => ({ adminRpcMock: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: adminRpcMock }) }));

import { loadParents, loadStudents } from "./users-data";

const queues = new Map<string, QueryResult[]>();
const callCounts = new Map<string, number>();

function setQueue(table: string, results: QueryResult[]) {
  queues.set(table, [...results]);
}
function nextResult(table: string): QueryResult {
  const queue = queues.get(table);
  if (!queue || queue.length === 0) return { data: [], error: null };
  return queue.length === 1 ? queue[0] : queue.shift()!;
}
function supabaseMock() {
  return {
    from: (table: string) => {
      callCounts.set(table, (callCounts.get(table) ?? 0) + 1);
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "not", "order", "is", "gt", "limit"]) {
        chain[method] = () => chain;
      }
      chain.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
      return chain;
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  queues.clear();
  callCounts.clear();
  adminRpcMock.mockResolvedValue({
    data: [
      { user_id: "g1", email: "g1@example.com" },
      { user_id: "g2", email: "g2@example.com" },
      { user_id: "c1", email: "c1@example.com" },
      { user_id: "c2", email: "c2@example.com" },
    ],
    error: null,
  });
});

describe("loadParents — 아카이브 필터", () => {
  it("아카이브된 가구의 보호자는 제외하고, 남은 보호자에는 householdId를 채운다", async () => {
    setQueue("parents", [
      {
        data: [
          { id: "g1", joined_at: "2026-01-02", profile: { name: "활성보호자" } },
          { id: "g2", joined_at: "2026-01-01", profile: { name: "아카이브보호자" } },
        ],
        error: null,
      },
    ]);
    setQueue("household_members", [
      // guardian 링크
      {
        data: [
          { profile_id: "g1", household_id: "h1" },
          { profile_id: "g2", household_id: "h2" },
        ],
        error: null,
      },
      // child 링크
      {
        data: [
          { household_id: "h1", child: { name: "활성자녀" } },
          { household_id: "h2", child: { name: "아카이브자녀" } },
        ],
        error: null,
      },
    ]);
    setQueue("households", [{ data: [{ id: "h2" }], error: null }]);

    const result = await loadParents(supabaseMock());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "g1", name: "활성보호자", householdId: "h1", childrenNames: ["활성자녀"] });
    // 아카이브 household 조회는 목록당 1회만 한다.
    expect(callCounts.get("households")).toBe(1);
  });

  it("아카이브된 가구가 없으면 모든 보호자를 그대로 반환한다", async () => {
    setQueue("parents", [{ data: [{ id: "g1", joined_at: "2026-01-02", profile: { name: "보호자" } }], error: null }]);
    setQueue("household_members", [
      { data: [{ profile_id: "g1", household_id: "h1" }], error: null },
      { data: [], error: null },
    ]);
    setQueue("households", [{ data: [], error: null }]);

    const result = await loadParents(supabaseMock());
    expect(result.map((p) => p.id)).toEqual(["g1"]);
  });
});

describe("loadStudents — 아카이브 필터", () => {
  it("아카이브된 가구의 자녀는 목록에서 빠진다", async () => {
    setQueue("students", [
      {
        data: [
          { id: "c1", grade: "10학년", status: "active", credit_balance: 0, target_colleges: [], intended_majors: [], profile: { name: "활성자녀" } },
          { id: "c2", grade: "9학년", status: "active", credit_balance: 0, target_colleges: [], intended_majors: [], profile: { name: "아카이브자녀" } },
        ],
        error: null,
      },
    ]);
    setQueue("household_members", [
      // child 링크
      {
        data: [
          { profile_id: "c1", household_id: "h1" },
          { profile_id: "c2", household_id: "h2" },
        ],
        error: null,
      },
      // guardian 링크
      { data: [{ household_id: "h1", guardian: { name: "활성보호자" } }], error: null },
    ]);
    setQueue("households", [{ data: [{ id: "h2" }], error: null }]);

    const result = await loadStudents(supabaseMock());

    expect(result.map((s) => s.id)).toEqual(["c1"]);
    expect(result[0].parentNames).toEqual(["활성보호자"]);
  });
});
