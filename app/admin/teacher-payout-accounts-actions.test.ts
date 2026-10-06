import { beforeEach, describe, expect, it, vi } from "vitest";

// 관리자 수취 계좌 액션 — 권한(정산권한/마스터), 검증, 진행 중 송금 차단, reveal 위임을 검증한다.
const { staffMock, rpcMock, fromMock } = vi.hoisted(() => ({ staffMock: vi.fn(), rpcMock: vi.fn(), fromMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: vi.fn(), requirePayoutAccountStaff: staffMock }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock, from: fromMock }) }));

import { revealTeacherPayoutAccountAction, saveTeacherPayoutAccountByAdminAction, getPayoutAccountStaffPermissionAction } from "./teacher-payout-accounts-actions";

function chainResult(data: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "limit"]) chain[m] = () => chain;
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
    await expect(revealTeacherPayoutAccountAction("t1")).rejects.toThrow("권한");
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
    fromMock.mockImplementation((t: string) => (t === "profiles" ? chainResult({ role: "teacher" }) : chainResult([{ id: "b1" }])));
    const r = await saveTeacherPayoutAccountByAdminAction("t1", INPUT);
    expect(r.status).toBe("invalid");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("정상: by_admin=true로 DB 함수에 넘기고 번호는 숫자만 정규화한다", async () => {
    fromMock.mockImplementation((t: string) => (t === "profiles" ? chainResult({ role: "teacher" }) : chainResult([])));
    rpcMock.mockResolvedValue({ data: { changed_fields: ["bank_name"] }, error: null });
    const r = await saveTeacherPayoutAccountByAdminAction("t1", INPUT);
    expect(r).toEqual({ status: "saved", changedFields: ["bank_name"] });
    expect(rpcMock).toHaveBeenCalledWith("save_teacher_payout_account", expect.objectContaining({ p_teacher_id: "t1", p_actor_id: "admin-1", p_by_admin: true, p_number: "110123456789" }));
  });

  it("교사가 아닌 대상은 거절", async () => {
    fromMock.mockImplementation(() => chainResult({ role: "parent" }));
    expect((await saveTeacherPayoutAccountByAdminAction("t1", INPUT)).status).toBe("invalid");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("revealTeacherPayoutAccountAction", () => {
  it("DB reveal 함수(감사 포함)에 위임하고 값을 매핑한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ account_holder_name: "김", bank_name: "국민", account_number: "110123456789", swift_or_routing: null, currency: "KRW", country: "KR" }], error: null });
    const r = await revealTeacherPayoutAccountAction("t1", " 수동 송금 ");
    expect(rpcMock).toHaveBeenCalledWith("reveal_teacher_payout_account", { p_teacher_id: "t1", p_actor_id: "admin-1", p_reason: "수동 송금" });
    expect(r.accountNumber).toBe("110123456789");
  });
});
