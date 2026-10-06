import { beforeEach, describe, expect, it, vi } from "vitest";

const { staffMock, rpcMock, getUserMock, listConsultantsMock, fromMock } = vi.hoisted(() => ({ staffMock: vi.fn(), rpcMock: vi.fn(), getUserMock: vi.fn(), listConsultantsMock: vi.fn(), fromMock: vi.fn() }));
vi.mock("./consultant-assignment-actions", () => ({ listConsultantsAction: listConsultantsMock }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: vi.fn().mockResolvedValue({}), requirePayoutAccountStaff: staffMock }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock, from: fromMock, auth: { admin: { getUserById: getUserMock } } }) }));

import { getConsultantContractFeeAction, listPayoutConsultantsAction, revealConsultantPayoutAccountAction, saveConsultantPayoutAccountByAdminAction } from "./consultant-settlement-actions";

const INPUT = { accountHolderName: "지만", bankName: "국민은행", accountNumber: "110-123-456789", currency: "KRW", country: "KR" };

beforeEach(() => {
  vi.clearAllMocks();
  staffMock.mockResolvedValue({ actorUserId: "admin-1" });
  getUserMock.mockResolvedValue({ data: { user: { id: "c1" } } });
});

describe("컨설턴트 계좌 관리자 액션 — 권한·검증·위임", () => {
  it("권한이 없으면 대리 입력·전체 번호 보기 모두 거부(DB 호출 없음)", async () => {
    staffMock.mockRejectedValue(new Error("이 작업을 수행할 권한이 없습니다"));
    await expect(saveConsultantPayoutAccountByAdminAction("c1", INPUT)).rejects.toThrow("권한");
    await expect(revealConsultantPayoutAccountAction("c1", "수동 송금 사유")).rejects.toThrow("권한");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("검증 오류는 한국어로, USD는 ABA 9자리", async () => {
    expect(await saveConsultantPayoutAccountByAdminAction("c1", { ...INPUT, accountNumber: "12" })).toMatchObject({ status: "invalid" });
    expect(await saveConsultantPayoutAccountByAdminAction("c1", { ...INPUT, currency: "USD", country: "US", accountNumber: "000123456789" })).toEqual({
      status: "invalid",
      message: "USD 계좌는 9자리 ABA 라우팅 번호가 필요합니다.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("전체 번호 보기 사유가 5자 미만이면 거부", async () => {
    await expect(revealConsultantPayoutAccountAction("c1", "abc")).rejects.toThrow("5자 이상");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("정상: by_admin=true로 DB 함수 호출, reveal은 DB reveal 함수에 위임", async () => {
    rpcMock.mockResolvedValueOnce({ data: { changed_fields: ["account_number"] }, error: null });
    expect(await saveConsultantPayoutAccountByAdminAction("c1", INPUT)).toEqual({ status: "saved", changedFields: ["account_number"] });
    expect(rpcMock).toHaveBeenLastCalledWith("save_consultant_payout_account", expect.objectContaining({ p_consultant_id: "c1", p_actor_id: "admin-1", p_by_admin: true, p_number: "110123456789" }));

    rpcMock.mockResolvedValueOnce({ data: [{ account_holder_name: "지만", bank_name: "국민", account_number: "110123456789", swift_or_routing: null, currency: "KRW", country: "KR" }], error: null });
    const r = await revealConsultantPayoutAccountAction("c1", " 수동 송금 ");
    expect(rpcMock).toHaveBeenLastCalledWith("reveal_consultant_payout_account", { p_consultant_id: "c1", p_actor_id: "admin-1", p_reason: "수동 송금" });
    expect(r.accountNumber).toBe("110123456789");
  });
});

describe("삭제된 컨설턴트 제외", () => {
  it("목록에서 인증 계정이 없는(삭제된) 컨설턴트는 빠진다", async () => {
    listConsultantsMock.mockResolvedValue([
      { id: "c1", name: "활성", email: "a@x.com", students: [] },
      { id: "c-del", name: null, email: null, students: [] },
    ]);
    expect((await listPayoutConsultantsAction()).map((c) => c.id)).toEqual(["c1"]);
  });

  it("삭제된 계정에는 대신 입력할 수 없다(서버 차단, DB 호출 없음)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect(await saveConsultantPayoutAccountByAdminAction("c-del", INPUT)).toEqual({
      status: "invalid",
      message: "삭제되었거나 존재하지 않는 계정에는 계좌를 입력할 수 없습니다.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

function feeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  chain.then = (f: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(f);
  return chain;
}

describe("getConsultantContractFeeAction — 서명된 계약의 월 보수", () => {
  it("서명된 계약 스냅샷의 월 보수·통화·시작일을 돌려준다(문자열 bigint도 숫자로)", async () => {
    fromMock.mockReturnValue(feeChain([{ inputs_snapshot: { monthly_fee_minor: "3100000", monthly_fee_currency: "KRW", start_date: "2026-10-01" }, signed_at: "2026-10-02T00:00:00Z" }]));
    expect(await getConsultantContractFeeAction("c1")).toEqual({ monthlyFeeMinor: 3100000, currency: "KRW", startDate: "2026-10-01", signedAt: "2026-10-02T00:00:00Z" });
    expect(fromMock).toHaveBeenCalledWith("teacher_contracts");
  });
  it("서명된 계약이 없거나 보수·통화가 비면 null(제안하지 않는다)", async () => {
    fromMock.mockReturnValue(feeChain([]));
    expect(await getConsultantContractFeeAction("c1")).toBeNull();
    fromMock.mockReturnValue(feeChain([{ inputs_snapshot: { monthly_fee_minor: null, monthly_fee_currency: "KRW" }, signed_at: null }]));
    expect(await getConsultantContractFeeAction("c1")).toBeNull();
    fromMock.mockReturnValue(feeChain([{ inputs_snapshot: { monthly_fee_minor: 100, monthly_fee_currency: "EUR" }, signed_at: null }]));
    expect(await getConsultantContractFeeAction("c1")).toBeNull();
  });
});
