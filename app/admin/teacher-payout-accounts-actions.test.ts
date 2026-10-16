import { beforeEach, describe, expect, it, vi } from "vitest";

// 관리자 수취 계좌 액션 — 권한(정산권한/마스터), 검증, 진행 중 송금 차단, reveal 위임을 검증한다.
const { staffMock, rpcMock, fromMock } = vi.hoisted(() => ({ staffMock: vi.fn(), rpcMock: vi.fn(), fromMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: vi.fn(), requirePayoutAccountStaff: staffMock }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock, from: fromMock }) }));

import { listTeacherPayoutAccountsAction, revealTeacherPayoutAccountAction, saveTeacherPayoutAccountByAdminAction, getPayoutAccountStaffPermissionAction } from "./teacher-payout-accounts-actions";

function chainResult(data: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "limit", "order"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data, error: null });
  chain.then = (f: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(f);
  return chain;
}

const INPUT = { accountHolderName: "김선생", bankName: "국민은행", accountNumber: "110-123-456789", currency: "KRW", country: "KR" };

beforeEach(() => {
  vi.clearAllMocks();
  staffMock.mockResolvedValue({ actorUserId: "admin-1" });
});

describe("권한: 정산권한·마스터가 아니면 모든 쓰기·reveal 액션이 거부된다", () => {
  it("대리 입력", async () => {
    staffMock.mockRejectedValue(new Error("이 작업을 수행할 권한이 없습니다"));
    await expect(saveTeacherPayoutAccountByAdminAction("t1", INPUT)).rejects.toThrow("권한");
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("전체 번호 보기", async () => {
    staffMock.mockRejectedValue(new Error("이 작업을 수행할 권한이 없습니다"));
    await expect(revealTeacherPayoutAccountAction("t1", "수동 송금 사유")).rejects.toThrow("권한");
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("권한 조회는 예외 대신 canManage=false", async () => {
    staffMock.mockRejectedValue(new Error("no"));
    expect(await getPayoutAccountStaffPermissionAction()).toEqual({ canManage: false });
  });
});

describe("saveTeacherPayoutAccountByAdminAction", () => {
  it("검증 오류는 한국어로 돌려주고 DB를 부르지 않는다", async () => {
    const r = await saveTeacherPayoutAccountByAdminAction("t1", { ...INPUT, accountNumber: "12" });
    expect(r.status).toBe("invalid");
    if (r.status === "invalid") expect(r.message).toMatch(/자릿수/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("USD는 9자리 ABA 라우팅이 필요하다", async () => {
    const r = await saveTeacherPayoutAccountByAdminAction("t1", { ...INPUT, currency: "USD", country: "US", accountNumber: "000123456789" });
    expect(r).toEqual({ status: "invalid", message: "USD 계좌는 9자리 ABA 라우팅 번호가 필요합니다." });
  });

  it("송금 진행 중인 묶음이 있으면 막는다", async () => {
    fromMock.mockImplementation((t: string) => (t === "teachers" ? chainResult({ status: "active" }) : chainResult([{ id: "b1" }])));
    const r = await saveTeacherPayoutAccountByAdminAction("t1", INPUT);
    expect(r.status).toBe("invalid");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("정상: by_admin=true로 DB 함수에 넘기고 번호는 숫자만 정규화한다", async () => {
    fromMock.mockImplementation((t: string) => (t === "teachers" ? chainResult({ status: "pending" }) : chainResult([])));
    rpcMock.mockResolvedValue({ data: { changed_fields: ["bank_name"] }, error: null });
    const r = await saveTeacherPayoutAccountByAdminAction("t1", INPUT);
    expect(r).toEqual({ status: "saved", changedFields: ["bank_name"] });
    expect(rpcMock).toHaveBeenCalledWith("save_teacher_payout_account", expect.objectContaining({ p_teacher_id: "t1", p_actor_id: "admin-1", p_by_admin: true, p_number: "110123456789" }));
  });

  it("종료 진행·종료된 계정에는 대신 입력할 수 없다(서버 차단)", async () => {
    for (const status of ["closure_pending", "closed"]) {
      fromMock.mockImplementation(() => chainResult({ status }));
      const r = await saveTeacherPayoutAccountByAdminAction("t1", INPUT);
      expect(r).toEqual({ status: "invalid", message: "종료 처리 중이거나 종료된 계정에는 계좌를 입력할 수 없습니다." });
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("정지·비활성 교사에는 입력할 수 있다(이미 번 정산을 받을 수 있어야 한다)", async () => {
    for (const status of ["suspended", "inactive"]) {
      fromMock.mockImplementation((t: string) => (t === "teachers" ? chainResult({ status }) : chainResult([])));
      rpcMock.mockResolvedValue({ data: { changed_fields: [] }, error: null });
      expect((await saveTeacherPayoutAccountByAdminAction("t1", INPUT)).status).toBe("saved");
    }
  });

  it("교사가 아닌 대상은 거절", async () => {
    fromMock.mockImplementation(() => chainResult(null));
    expect((await saveTeacherPayoutAccountByAdminAction("t1", INPUT)).status).toBe("invalid");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("revealTeacherPayoutAccountAction", () => {
  it("사유가 5자 미만이면 DB를 부르지 않고 거부한다", async () => {
    await expect(revealTeacherPayoutAccountAction("t1", "  짧음 ")).rejects.toThrow("5자 이상");
    await expect(revealTeacherPayoutAccountAction("t1", "")).rejects.toThrow("5자 이상");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("DB reveal 함수(감사 포함)에 위임하고 값을 매핑한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ account_holder_name: "김", bank_name: "국민", account_number: "110123456789", swift_or_routing: null, currency: "KRW", country: "KR" }], error: null });
    const r = await revealTeacherPayoutAccountAction("t1", " 수동 송금 ");
    expect(rpcMock).toHaveBeenCalledWith("reveal_teacher_payout_account", { p_teacher_id: "t1", p_actor_id: "admin-1", p_reason: "수동 송금" });
    expect(r.accountNumber).toBe("110123456789");
  });
});

describe("listTeacherPayoutAccountsAction — 활성 계열 교사만", () => {
  function tableData(map: Record<string, unknown>) {
    fromMock.mockImplementation((t: string) => chainResult(map[t] ?? []));
  }
  it("종료·종료 진행 교사의 계좌와 teachers 행이 없는 프로필은 목록에서 빠지고, 활성 교사의 미등록은 '미등록'으로 남는다", async () => {
    staffMock.mockResolvedValue({ actorUserId: "admin-1" });
    tableData({
      teacher_payout_accounts: [
        { teacher_id: "t-active", account_holder_name: "A", bank_name: "B", account_number_last4: "1234", swift_or_routing_last4: null, currency: "KRW", country: "KR", entered_by_admin: false, updated_at: "2026-10-01T00:00:00Z" },
        { teacher_id: "t-closed", account_holder_name: "C", bank_name: "D", account_number_last4: "9999", swift_or_routing_last4: null, currency: "KRW", country: "KR", entered_by_admin: false, updated_at: "2026-10-01T00:00:00Z" },
      ],
      teachers: [{ id: "t-active" }, { id: "t-pending" }],
      profiles: [{ id: "t-pending", name: "대기" }],
      teacher_payout_account_events: [],
    });
    const rows = await listTeacherPayoutAccountsAction();
    const ids = rows.map((r) => r.teacherId).sort();
    expect(ids).toEqual(["t-active", "t-pending"]);
    expect(rows.find((r) => r.teacherId === "t-pending")?.registered).toBe(false);
    expect(rows.find((r) => r.teacherId === "t-active")?.accountNumberMasked).toBe("****1234");
    expect(JSON.stringify(rows)).not.toContain("t-closed");
  });
});
