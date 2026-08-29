import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

const computePayoutAmountsMock = vi.fn();
vi.mock("./payouts-data", () => ({
  computePayoutAmounts: computePayoutAmountsMock,
}));

const existingCheckMock = vi.fn();
const payoutsInsertMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "teacher_payouts") {
    return {
      select: (cols: string) => {
        if (cols === "id") {
          return { eq: () => ({ eq: () => ({ eq: existingCheckMock }) }) };
        }
        throw new Error(`unexpected select ${cols}`);
      },
      insert: payoutsInsertMock,
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: fromMock,
  }),
}));

describe("generatePayoutsAsCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computePayoutAmountsMock.mockResolvedValue({
      amounts: [
        { teacherId: "t1", teacherName: "박서연", amountKrw: 75000, totalMinutes: 150 },
      ],
      skipped: [{ teacherId: "t2", teacherName: "이도현" }],
    });
    existingCheckMock.mockResolvedValue({ data: [] });
    payoutsInsertMock.mockResolvedValue({ error: null });
  });

  it("requireAdmin을 호출하지 않고 service_role admin 클라이언트로 바로 실행한다", async () => {
    const { generatePayoutsAsCron } = await import("./payouts-cron");
    const { requireAdmin } = await import("@/lib/admin-auth");

    const result = await generatePayoutsAsCron({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });

    expect(requireAdmin).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("teacher_payouts");
    expect(payoutsInsertMock).toHaveBeenCalledWith({
      teacher_id: "t1",
      amount_krw: 75000,
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      status: "pending",
    });
    expect(result).toEqual({
      created: 1,
      skippedNoRate: [{ teacherId: "t2", teacherName: "이도현" }],
    });
  });
});
