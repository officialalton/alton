import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

// R10 Task C (2026-09-07) — 레거시 teacher_payouts에 쓰던 서버 액션들은 v3
// payout_batches로 대체됐고, 다시 호출되더라도 아무 것도 쓰지 않도록 막혀 있어야 한다.
describe("legacy payouts-actions (disabled, v3 payout_batches로 대체됨)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generatePayouts는 관리자 확인 후 항상 실패한다", async () => {
    const { generatePayouts } = await import("./payouts-actions");
    await expect(
      generatePayouts({ periodStart: "2026-08-01", periodEnd: "2026-08-31" })
    ).rejects.toThrow("v3 payout_batches");
  });

  it("markPayoutPaid는 항상 실패한다", async () => {
    const { markPayoutPaid } = await import("./payouts-actions");
    await expect(markPayoutPaid("p1")).rejects.toThrow("v3 payout_batches");
  });

  it("markPayoutsPaidBulk는 항상 실패한다", async () => {
    const { markPayoutsPaidBulk } = await import("./payouts-actions");
    await expect(markPayoutsPaidBulk(["p1", "p2"])).rejects.toThrow("v3 payout_batches");
  });

  it("revertPayoutToPending은 항상 실패한다", async () => {
    const { revertPayoutToPending } = await import("./payouts-actions");
    await expect(revertPayoutToPending("p1")).rejects.toThrow("v3 payout_batches");
  });
});
