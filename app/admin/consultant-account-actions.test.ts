import { beforeEach, describe, expect, it, vi } from "vitest";

const { staffMock, rpcMock } = vi.hoisted(() => ({ staffMock: vi.fn(), rpcMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: vi.fn(), requirePayoutAccountStaff: staffMock }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock, from: vi.fn() }) }));

import { revealConsultantPayoutAccountAction, saveConsultantPayoutAccountByAdminAction } from "./consultant-settlement-actions";

const INPUT = { accountHolderName: "지만", bankName: "국민은행", accountNumber: "110-123-456789", currency: "KRW", country: "KR" };

beforeEach(() => {
  vi.clearAllMocks();
  staffMock.mockResolvedValue({ actorUserId: "admin-1" });
});

describe("컨설턴트 계좌 관리자 액션 — 권한·검증·위임", () => {
  it("권한이 없으면 대리 입력·전체 번호 보기 모두 거부(DB 호출 없음)", async () => {
    staffMock.mockRejectedValue(new Error("이 작업을 수행할 권한이 없습니다"));
    await expect(saveConsultantPayoutAccountByAdminAction("c1", INPUT)).rejects.toThrow("권한");
    await expect(revealConsultantPayoutAccountAction("c1")).rejects.toThrow("권한");
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
