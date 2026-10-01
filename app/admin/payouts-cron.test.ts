import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

const computePayoutAmountsMock = vi.fn();
vi.mock("./payouts-data", () => ({
  computePayoutAmounts: computePayoutAmountsMock,
}));

// R10 corrective(요구사항 3, 2026-09-07 리뷰) — runGeneratePayouts()가
// teacher_payouts에 대해 어떤 테이블 접근도 하지 않는지 확인한다. fromMock이
// 한 번이라도 호출되면(어떤 테이블이든) 실패시켜, "amounts는 계산하되
// teacher_payouts에는 쓰지 않는다"는 no-op 계약을 강제한다.
const fromMock = vi.fn((table: string) => {
  throw new Error(`no-op이어야 하는 runGeneratePayouts가 테이블 ${table}에 접근했습니다.`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: fromMock,
  }),
}));

describe("generatePayoutsAsCron (R10 corrective: no-op)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computePayoutAmountsMock.mockResolvedValue({
      amounts: [
        { teacherId: "t1", teacherName: "박서연", amountKrw: 75000, totalMinutes: 150 },
      ],
      skipped: [{ teacherId: "t2", teacherName: "이도현" }],
    });
  });

  it("teacher_payouts에 전혀 쓰지 않고 created:0을 반환한다(레거시 쓰기 경로 완전 제거)", async () => {
    const { generatePayoutsAsCron } = await import("./payouts-cron");
    const { requireAdmin } = await import("@/lib/admin-auth");

    const result = await generatePayoutsAsCron({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });

    expect(requireAdmin).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      skippedNoRate: [{ teacherId: "t2", teacherName: "이도현" }],
    });
  });
});
