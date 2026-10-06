import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireConsultantMock } = vi.hoisted(() => ({ requireConsultantMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireConsultant: requireConsultantMock }));

const { adminFromMock, adminRpcMock } = vi.hoisted(() => ({ adminFromMock: vi.fn(), adminRpcMock: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ from: adminFromMock, rpc: adminRpcMock }) }));

import { getMyPayoutAccountAction, saveMyPayoutAccountAction, listMyPayoutPeriodsAction, markMyPayoutNoticeReadAction } from "./settlement-actions";

beforeEach(() => {
  requireConsultantMock.mockReset();
  adminFromMock.mockReset();
  adminRpcMock.mockReset();
});

describe("getMyPayoutAccountAction", () => {
  it("전체 계좌번호 없이 마스킹된 값만 반환한다", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    adminFromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                account_holder_name: "지만",
                bank_name: "국민은행",
                account_number_last4: "1234",
                currency: "KRW",
                country: null,
                swift_or_routing_last4: null,
                updated_at: "2026-09-23T00:00:00Z",
              },
              error: null,
            }),
        }),
      }),
    });

    const result = await getMyPayoutAccountAction();

    expect(result?.accountNumberMasked).toBe("****1234");
    expect(JSON.stringify(result)).not.toContain("account_number");
  });

  it("계좌가 없으면 null", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    adminFromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) });
    expect(await getMyPayoutAccountAction()).toBeNull();
  });
});

describe("saveMyPayoutAccountAction — 최초 1회 등록만", () => {
  const VALID = { accountHolderName: "지만", bankName: "국민은행", accountNumber: "110-123-456789", currency: "krw", country: "KR" };
  const noExisting = () =>
    adminFromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) });

  it("통화별 검증: 자릿수·USD 라우팅 오류는 DB를 부르지 않는다", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    expect((await saveMyPayoutAccountAction({ ...VALID, accountNumber: "12" })).status).toBe("invalid");
    expect(await saveMyPayoutAccountAction({ ...VALID, currency: "USD", country: "US", accountNumber: "000123456789" })).toEqual({
      status: "invalid",
      message: "A U.S. account needs a 9-digit ABA routing number.",
    });
    expect(adminRpcMock).not.toHaveBeenCalled();
  });

  it("정상 입력이면 DB 함수(암호화·이력)로 저장하고 응답엔 마스킹 값만 담는다", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    noExisting();
    adminRpcMock.mockResolvedValue({ data: { created: true }, error: null });

    const result = await saveMyPayoutAccountAction(VALID);

    expect(result.status).toBe("saved");
    if (result.status === "saved") expect(result.account.accountNumberMasked).toBe("****6789");
    expect(adminRpcMock).toHaveBeenCalledWith("save_consultant_payout_account", expect.objectContaining({ p_consultant_id: "c1", p_actor_id: "c1", p_by_admin: false, p_number: "110123456789" }));
  });

  it("이미 등록돼 있으면 서버에서 거절한다(DB 함수 호출 없음)", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    adminFromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "a1" }, error: null }) }) }) });
    expect(await saveMyPayoutAccountAction(VALID)).toEqual({ status: "invalid", message: "To change your account details, contact ALTON staff." });
    expect(adminRpcMock).not.toHaveBeenCalled();
  });

  it("DB가 LOCKED를 돌려줘도(동시 요청) 같은 메시지", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    noExisting();
    adminRpcMock.mockResolvedValue({ data: null, error: { message: "LOCKED: …" } });
    expect(await saveMyPayoutAccountAction(VALID)).toEqual({ status: "invalid", message: "To change your account details, contact ALTON staff." });
  });

  it("컨설턴트가 아니면 거부", async () => {
    requireConsultantMock.mockRejectedValue(new Error("컨설턴트만 사용할 수 있습니다."));
    await expect(saveMyPayoutAccountAction(VALID)).rejects.toThrow("컨설턴트만");
    expect(adminRpcMock).not.toHaveBeenCalled();
  });
});

describe("markMyPayoutNoticeReadAction", () => {
  it("본인 알림만 읽음 처리한다(소유자 스코프)", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    const eqs: Array<[string, unknown]> = [];
    const chain: Record<string, unknown> = {};
    chain.update = () => chain;
    chain.eq = (c: string, v: unknown) => { eqs.push([c, v]); return chain; };
    chain.is = () => Promise.resolve({ error: null });
    adminFromMock.mockReturnValue(chain);
    expect(await markMyPayoutNoticeReadAction("11111111-1111-1111-1111-111111111111")).toEqual({ ok: true });
    expect(eqs).toContainEqual(["teacher_id", "c1"]);
    expect(await markMyPayoutNoticeReadAction("bad id")).toEqual({ ok: false });
  });
});

describe("listMyPayoutPeriodsAction", () => {
  it("본인 세션 클라이언트로 조회한다(RLS가 confirmed/paid만 보여줌)", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: "p1",
                    period_start: "2026-09-01",
                    period_end: "2026-09-30",
                    amount_minor: 500000,
                    currency: "KRW",
                    status: "confirmed",
                    note: null,
                    confirmed_at: "2026-09-23T00:00:00Z",
                    paid_at: null,
                  },
                ],
                error: null,
              }),
          }),
        }),
      }),
    };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });

    const result = await listMyPayoutPeriodsAction();

    expect(result).toEqual([
      {
        id: "p1",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        amountMinor: 500000,
        currency: "KRW",
        status: "confirmed",
        note: null,
        confirmedAt: "2026-09-23T00:00:00Z",
        paidAt: null,
      },
    ]);
  });
});
