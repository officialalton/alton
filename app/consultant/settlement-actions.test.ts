import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireConsultantMock } = vi.hoisted(() => ({ requireConsultantMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireConsultant: requireConsultantMock }));

const { adminFromMock } = vi.hoisted(() => ({ adminFromMock: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ from: adminFromMock }) }));

import { getMyPayoutAccountAction, saveMyPayoutAccountAction, listMyPayoutPeriodsAction } from "./settlement-actions";

beforeEach(() => {
  requireConsultantMock.mockReset();
  adminFromMock.mockReset();
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
                swift_or_routing: null,
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

describe("saveMyPayoutAccountAction", () => {
  it("계좌번호가 4자리 미만이면 invalid", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    const result = await saveMyPayoutAccountAction({ accountHolderName: "지만", bankName: "국민", accountNumber: "12", currency: "KRW" });
    expect(result).toEqual({ status: "invalid", message: "계좌번호를 정확히 입력해주세요(숫자 4자리 이상)." });
  });

  it("정상 입력이면 저장하고 이력을 남긴다", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultant_payout_accounts") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === "consultant_payout_account_events") {
        return { insert: insertMock };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await saveMyPayoutAccountAction({
      accountHolderName: "지만",
      bankName: "국민은행",
      accountNumber: "110-123-456789",
      currency: "krw",
    });

    expect(result.status).toBe("saved");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ consultant_id: "c1", action: "created" }));
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
