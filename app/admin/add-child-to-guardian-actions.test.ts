import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-11(P4-1) — 기존 주 보호자에게 자녀 추가.
// 확정 정책 검증: (1) 후보는 주 보호자만, (2) 발송은 클라이언트가 준 이메일이
// 아니라 서버가 다시 해석한 보호자 이메일로 나가고, (3) 주 보호자가 아니면
// 링크 생성·발송을 아예 시작하지 않으며, (4) 자녀 이메일이 기존 auth.users와
// 겹치면(lib/onboarding-email-guard.ts) 링크 생성 RPC·메일 발송이 전혀 일어나지
// 않는다, (5) 발송 경로는 기존 직접 생성(create_direct_onboarding_link_multi)
// 하나뿐이다.

type QueryResult = { data: unknown; error: unknown };

const { adminRpcMock, adminFromMock, sendEmailMock, requireAdminOrCapabilityMock } = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
  adminFromMock: vi.fn(),
  sendEmailMock: vi.fn(),
  requireAdminOrCapabilityMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: requireAdminOrCapabilityMock }));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock, escapeHtml: (v: string) => v }));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost:3010") }));

import { searchPrimaryGuardiansAction, sendAddChildToGuardianNoticeAction } from "./direct-account-actions";

// 테이블별 결과 큐 — 같은 테이블을 여러 번 조회하면 순서대로 꺼내 쓰고,
// 큐가 하나만 있으면 매번 같은 값을 돌려준다.
const queues = new Map<string, QueryResult[]>();
function setTableResults(table: string, results: QueryResult[]) {
  queues.set(table, results);
}
function nextResult(table: string): QueryResult {
  const queue = queues.get(table);
  if (!queue || queue.length === 0) return { data: null, error: null };
  return queue.length === 1 ? queue[0] : queue.shift()!;
}

function builder(table: string) {
  const result = () => nextResult(table);
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "ilike", "order", "limit", "is", "update", "insert"]) {
    chain[method] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(result());
  chain.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(onFulfilled, onRejected);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  queues.clear();
  requireAdminOrCapabilityMock.mockResolvedValue({ actorUserId: "admin1" });
  adminFromMock.mockImplementation((table: string) => builder(table));
  sendEmailMock.mockResolvedValue(undefined);
  adminRpcMock.mockImplementation((fn: string) => {
    if (fn === "find_auth_user_id_by_email") return Promise.resolve({ data: null, error: null });
    if (fn === "get_emails_by_user_ids") {
      return Promise.resolve({ data: [{ user_id: "g1", email: "guardian1@example.com" }], error: null });
    }
    if (fn === "create_direct_onboarding_link_multi") {
      return Promise.resolve({ data: [{ link_id: "link1", raw_token: "raw-token-abc" }], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe("searchPrimaryGuardiansAction", () => {
  it("주 보호자만 후보로 반환하고 기존 자녀 이름을 함께 준다", async () => {
    setTableResults("profiles", [{ data: [{ id: "g1", name: "김보호자" }], error: null }]);
    setTableResults("households", [
      { data: [{ id: "h1", primary_guardian_id: "g1", created_at: "2026-01-01T00:00:00Z" }], error: null },
    ]);
    setTableResults("household_members", [
      { data: [{ household_id: "h1", child: { name: "김첫째" } }], error: null },
    ]);

    const result = await searchPrimaryGuardiansAction("김보");
    expect(result).toEqual([
      { guardianId: "g1", name: "김보호자", email: "guardian1@example.com", childrenNames: ["김첫째"] },
    ]);
  });

  it("주 보호자가 아닌 보호자(공동 보호자 등)는 후보에서 제외한다", async () => {
    setTableResults("profiles", [
      { data: [{ id: "g1", name: "김보호자" }, { id: "g2", name: "김공동보호자" }], error: null },
    ]);
    // g2는 어떤 household의 primary_guardian_id도 아니다.
    setTableResults("households", [
      { data: [{ id: "h1", primary_guardian_id: "g1", created_at: "2026-01-01T00:00:00Z" }], error: null },
    ]);
    setTableResults("household_members", [{ data: [], error: null }]);

    const result = await searchPrimaryGuardiansAction("보호자");
    expect(result.map((c) => c.guardianId)).toEqual(["g1"]);
  });

  it("검색어가 2자 미만이면 조회하지 않고 빈 목록을 반환한다", async () => {
    const result = await searchPrimaryGuardiansAction("김");
    expect(result).toEqual([]);
    expect(adminFromMock).not.toHaveBeenCalled();
  });
});

describe("sendAddChildToGuardianNoticeAction", () => {
  function arrangeValidGuardian() {
    setTableResults("households", [{ data: { id: "h1" }, error: null }]);
    setTableResults("profiles", [{ data: { name: "김보호자", role: "parent" }, error: null }]);
  }

  it("서버가 다시 해석한 보호자 이메일로 기존 직접 생성 경로를 그대로 호출한다", async () => {
    arrangeValidGuardian();
    const result = await sendAddChildToGuardianNoticeAction({
      guardianId: "g1",
      student: { name: "김둘째", email: "child2@example.com", grade: "9학년" },
    });

    expect(result.status).toBe("sent");
    expect(adminRpcMock).toHaveBeenCalledWith(
      "create_direct_onboarding_link_multi",
      expect.objectContaining({
        p_guardian_email: "guardian1@example.com",
        p_guardian_name: "김보호자",
        p_students: [{ name: "김둘째", email: "child2@example.com", grade: "9학년", subject: null }],
        p_admin_id: "admin1",
      })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "guardian1@example.com" }));
  });

  it("주 보호자가 아니면 링크 생성도 발송도 하지 않는다", async () => {
    setTableResults("households", [{ data: null, error: null }]);
    const result = await sendAddChildToGuardianNoticeAction({
      guardianId: "g2",
      student: { name: "김둘째", email: "child2@example.com" },
    });

    expect(result.status).toBe("failed");
    expect(adminRpcMock).not.toHaveBeenCalledWith("create_direct_onboarding_link_multi", expect.anything());
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("보호자 계정(role='parent')이 아니면 거부한다", async () => {
    setTableResults("households", [{ data: { id: "h1" }, error: null }]);
    setTableResults("profiles", [{ data: { name: "홍길동", role: "student" }, error: null }]);
    const result = await sendAddChildToGuardianNoticeAction({
      guardianId: "g3",
      student: { name: "김둘째", email: "child2@example.com" },
    });
    expect(result.status).toBe("failed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("자녀 이메일이 기존 Auth 계정과 겹치면 발급 전에 차단한다(링크·메일 없음)", async () => {
    arrangeValidGuardian();
    adminRpcMock.mockImplementation((fn: string) => {
      if (fn === "find_auth_user_id_by_email") return Promise.resolve({ data: "existing-uid", error: null });
      if (fn === "get_emails_by_user_ids") {
        return Promise.resolve({ data: [{ user_id: "g1", email: "guardian1@example.com" }], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await sendAddChildToGuardianNoticeAction({
      guardianId: "g1",
      student: { name: "김둘째", email: "taken@example.com" },
    });

    expect(result).toEqual({
      status: "duplicate_emails",
      collisions: [{ name: "김둘째", email: "taken@example.com" }],
    });
    expect(adminRpcMock).not.toHaveBeenCalledWith("create_direct_onboarding_link_multi", expect.anything());
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("권한이 없으면 실패 결과를 반환하고 아무 것도 발송하지 않는다", async () => {
    requireAdminOrCapabilityMock.mockRejectedValue(new Error("권한이 없습니다."));
    const result = await sendAddChildToGuardianNoticeAction({
      guardianId: "g1",
      student: { name: "김둘째", email: "child2@example.com" },
    });
    expect(result).toEqual({ status: "failed", linkId: "", error: "권한이 없습니다." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
