import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

const computePayoutAmountsMock = vi.fn();
vi.mock("./payouts-data", () => ({
  computePayoutAmounts: computePayoutAmountsMock,
}));

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
}));

const existingCheckMock = vi.fn();
const payoutsInsertMock = vi.fn().mockResolvedValue({ error: null });
const payoutsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const payoutsUpdateMock = vi.fn(() => ({ eq: payoutsUpdateEqMock }));
const payoutsSingleSelectMock = vi.fn();
// NOTE (deviation from brief): the brief declared `emailByIdMock` but never wired it into
// the createAdminClient mock, so `admin.auth.admin.getUserById` was `undefined` and the
// implementation's real lookup (matching the existing pattern in
// app/teacher/review/[sessionId]/review-actions.ts) would throw. Wiring it in here is the
// missing piece, not a behavior change — see payouts-task-5-report.md for details.
const emailByIdMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "teacher_payouts") {
    return {
      select: (cols: string) => {
        if (cols === "id") {
          return { eq: () => ({ eq: () => ({ eq: existingCheckMock }) }) };
        }
        return { eq: () => ({ single: payoutsSingleSelectMock }) };
      },
      insert: payoutsInsertMock,
      update: payoutsUpdateMock,
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: fromMock,
    auth: { admin: { getUserById: emailByIdMock } },
  }),
}));

describe("generatePayouts", () => {
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

  it("이미 같은 선생님·기간 정산이 없으면 새로 만들고, 시급 미설정 선생님은 skippedNoRate로 반환한다", async () => {
    const { generatePayouts } = await import("./payouts-actions");
    const result = await generatePayouts({ periodStart: "2026-08-01", periodEnd: "2026-08-31" });

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

  it("이미 같은 선생님·기간 정산이 있으면 건너뛴다", async () => {
    existingCheckMock.mockResolvedValue({ data: [{ id: "existing1" }] });
    const { generatePayouts } = await import("./payouts-actions");
    const result = await generatePayouts({ periodStart: "2026-08-01", periodEnd: "2026-08-31" });

    expect(payoutsInsertMock).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
  });
});

describe("markPayoutPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payoutsUpdateEqMock.mockResolvedValue({ error: null });
    payoutsSingleSelectMock.mockResolvedValue({
      data: { teacher_id: "t1", amount_krw: 75000 },
    });
    emailByIdMock.mockResolvedValue({ data: { user: { email: "teacher@example.com" } } });
  });

  it("상태를 paid로 바꾸고 선생님에게 이메일을 보낸다", async () => {
    const { markPayoutPaid } = await import("./payouts-actions");
    await markPayoutPaid("p1");

    expect(payoutsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", approved_by: "admin1" })
    );
    expect(payoutsUpdateEqMock).toHaveBeenCalledWith("id", "p1");
    expect(sendEmailMock).toHaveBeenCalled();
  });
});

describe("revertPayoutToPending", () => {
  it("상태를 pending으로 되돌리고 이메일은 보내지 않는다", async () => {
    vi.clearAllMocks();
    payoutsUpdateEqMock.mockResolvedValue({ error: null });
    const { revertPayoutToPending } = await import("./payouts-actions");
    await revertPayoutToPending("p1");

    expect(payoutsUpdateMock).toHaveBeenCalledWith({
      status: "pending",
      paid_at: null,
      approved_by: null,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
