import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

describe("payout-batches-actions (v3, R10 Task C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generatePayoutBatches는 generate_payout_batches RPC를 기간으로 호출하고 생성 개수를 반환한다", async () => {
    rpcMock.mockResolvedValue({ data: [{ id: "b1" }, { id: "b2" }], error: null });
    const { generatePayoutBatches } = await import("./payout-batches-actions");

    const result = await generatePayoutBatches("2026-08-01", "2026-08-31");

    expect(rpcMock).toHaveBeenCalledWith("generate_payout_batches", {
      p_period_start: "2026-08-01",
      p_period_end: "2026-08-31",
      p_teacher_id: null,
    });
    expect(result).toEqual({ created: 2 });
  });

  it("submitPayoutBatchForReview는 batchId로 submit RPC를 호출한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { submitPayoutBatchForReview } = await import("./payout-batches-actions");

    await submitPayoutBatchForReview("b1");

    expect(rpcMock).toHaveBeenCalledWith("submit_payout_batch_for_review", { p_batch_id: "b1" });
  });

  it("approvePayoutBatch는 admin의 id를 p_approved_by로 전달한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { approvePayoutBatch } = await import("./payout-batches-actions");

    await approvePayoutBatch("b1");

    expect(rpcMock).toHaveBeenCalledWith("approve_payout_batch", {
      p_batch_id: "b1",
      p_approved_by: "admin1",
    });
  });

  it("markPayoutBatchFailed는 사유와 actor를 함께 전달한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { markPayoutBatchFailed } = await import("./payout-batches-actions");

    await markPayoutBatchFailed("b1", "provider timeout");

    expect(rpcMock).toHaveBeenCalledWith("mark_payout_batch_failed", {
      p_batch_id: "b1",
      p_reason: "provider timeout",
      p_actor_id: "admin1",
    });
  });

  it("RPC가 에러를 반환하면 throw한다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "db error" } });
    const { approvePayoutBatch } = await import("./payout-batches-actions");

    await expect(approvePayoutBatch("b1")).rejects.toThrow("db error");
  });

  it("checkRealDisbursementEnabled는 fail-closed(에러 시 false)다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { checkRealDisbursementEnabled } = await import("./payout-batches-actions");

    await expect(checkRealDisbursementEnabled()).resolves.toBe(false);
  });

  it("checkRealDisbursementEnabled는 게이트가 열려있으면 true를 반환한다", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const { checkRealDisbursementEnabled } = await import("./payout-batches-actions");

    await expect(checkRealDisbursementEnabled()).resolves.toBe(true);
  });

  it("dispatch/processing/paid로 전환하는 액션은 정의돼 있지 않다 (법인 설립 전 정책)", async () => {
    const actions = await import("./payout-batches-actions");
    expect((actions as Record<string, unknown>).markPayoutBatchProcessing).toBeUndefined();
    expect((actions as Record<string, unknown>).markPayoutBatchPaid).toBeUndefined();
    expect((actions as Record<string, unknown>).dispatchPayoutBatch).toBeUndefined();
  });
});
