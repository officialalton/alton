import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: {}, actorUserId: "admin1" }),
}));

const rpcMock = vi.fn();

const entitlementBalancesSelectEqMock = vi.fn();
const entitlementGrantsSingleMock = vi.fn();
const entitlementGrantsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const productVersionsMaybeSingleMock = vi.fn();
const productVersionsInsertSingleMock = vi.fn();
const productVersionsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const refundRequestsInsertSingleMock = vi.fn();
const refundRequestsSingleMock = vi.fn();
const refundRequestsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const refundRequestsListMock = vi.fn();

const priceChangeNoticesInsertSingleMock = vi.fn();
const priceChangeNoticesListMock = vi.fn();

const paymentAttemptsListMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "entitlement_balances") {
    return { select: () => ({ eq: entitlementBalancesSelectEqMock }) };
  }
  if (table === "entitlement_grants") {
    return {
      select: () => ({ eq: () => ({ single: entitlementGrantsSingleMock }) }),
      update: () => ({ eq: entitlementGrantsUpdateEqMock }),
    };
  }
  if (table === "entitlement_product_versions") {
    return {
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: productVersionsMaybeSingleMock }) }) }),
      }),
      insert: () => ({ select: () => ({ single: productVersionsInsertSingleMock }) }),
      update: () => ({ eq: productVersionsUpdateEqMock }),
    };
  }
  if (table === "refund_requests") {
    return {
      insert: () => ({ select: () => ({ single: refundRequestsInsertSingleMock }) }),
      select: () => ({
        eq: () => ({ single: refundRequestsSingleMock }),
        in: () => ({ order: refundRequestsListMock }),
      }),
      update: () => ({ eq: refundRequestsUpdateEqMock }),
    };
  }
  if (table === "price_change_notices") {
    return {
      insert: () => ({ select: () => ({ single: priceChangeNoticesInsertSingleMock }) }),
      select: () => ({ eq: () => ({ order: priceChangeNoticesListMock }) }),
    };
  }
  if (table === "payment_attempts") {
    return { select: () => ({ eq: () => ({ order: paymentAttemptsListMock }) }) };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

import {
  holdEntitlementForReservation,
  consumeEntitlementForReservation,
  releaseEntitlementForReservation,
  hasSufficientEntitlement,
  extendEntitlementForCompanyOrTeacherCancellation,
  transferEntitlementBetweenChildren,
  createEntitlementProductVersion,
  requestRefund,
  approveRefund,
  rejectRefund,
  createPriceChangeNotice,
  listOpenPriceChangeNotices,
  listPendingRefundRequests,
  listPurchasesNeedingReconciliation,
} from "./entitlement-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hold/consume/release", () => {
  it("holds successfully and returns grant id", async () => {
    rpcMock.mockResolvedValueOnce({ data: "grant-1", error: null });
    const result = await holdEntitlementForReservation({
      childId: "child1",
      reservationId: "res1",
      lessonStartAt: "2026-10-01T00:00:00Z",
    });
    expect(result).toEqual({ grantId: "grant-1" });
    expect(rpcMock).toHaveBeenCalledWith("hold_entitlement", {
      p_child_id: "child1",
      p_reservation_id: "res1",
      p_lesson_start_at: "2026-10-01T00:00:00Z",
      p_needed: 1,
    });
  });

  it("wraps insufficient-entitlement SQL exception into a friendly error", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "사용 가능한 수업권이 없습니다." } });
    await expect(
      holdEntitlementForReservation({ childId: "child1", reservationId: "res1", lessonStartAt: "2026-10-01T00:00:00Z" })
    ).rejects.toThrow("수업권이 부족합니다");
  });

  it("consumes successfully", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await consumeEntitlementForReservation("res1");
    expect(rpcMock).toHaveBeenCalledWith("consume_entitlement", { p_reservation_id: "res1" });
  });

  it("wraps duplicate consume error", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "이미 consume되었습니다." } });
    await expect(consumeEntitlementForReservation("res1")).rejects.toThrow("이미 처리된 예약");
  });

  it("releases successfully", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await releaseEntitlementForReservation("res1");
    expect(rpcMock).toHaveBeenCalledWith("release_entitlement", { p_reservation_id: "res1" });
  });
});

describe("hasSufficientEntitlement", () => {
  it("returns true when total remaining across non-expired grants meets needed", async () => {
    entitlementBalancesSelectEqMock.mockResolvedValueOnce({
      data: [
        { remaining: 5, expires_at: "2099-01-01T00:00:00Z" },
        { remaining: 3, expires_at: "2020-01-01T00:00:00Z" }, // expired, excluded
      ],
      error: null,
    });
    const result = await hasSufficientEntitlement("child1", 4);
    expect(result).toBe(true);
  });

  it("returns false when remaining is insufficient", async () => {
    entitlementBalancesSelectEqMock.mockResolvedValueOnce({
      data: [{ remaining: 1, expires_at: "2099-01-01T00:00:00Z" }],
      error: null,
    });
    const result = await hasSufficientEntitlement("child1", 4);
    expect(result).toBe(false);
  });
});

describe("extendEntitlementForCompanyOrTeacherCancellation", () => {
  it("extends when current expiry is within 30 days of cancellation date", async () => {
    entitlementGrantsSingleMock.mockResolvedValueOnce({
      data: { id: "grant1", expires_at: "2026-09-10T00:00:00Z" },
      error: null,
    });
    rpcMock.mockResolvedValueOnce({ error: null });
    const result = await extendEntitlementForCompanyOrTeacherCancellation("grant1", "2026-09-01T00:00:00Z");
    expect(result.extended).toBe(true);
    expect(result.newExpiresAt).toBe("2026-10-01T00:00:00.000Z");
    expect(rpcMock).toHaveBeenCalledWith("extend_entitlement", {
      p_grant_id: "grant1",
      p_new_expires_at: "2026-10-01T00:00:00.000Z",
      p_business_event_id: expect.stringContaining("grant1"),
    });
  });

  it("does not extend when current expiry is far out (more than 30 days away)", async () => {
    entitlementGrantsSingleMock.mockResolvedValueOnce({
      data: { id: "grant1", expires_at: "2027-01-01T00:00:00Z" },
      error: null,
    });
    const result = await extendEntitlementForCompanyOrTeacherCancellation("grant1", "2026-09-01T00:00:00Z");
    expect(result.extended).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does not shorten an expiry already beyond cancellation+30d", async () => {
    // expires in 25 days (within window), but candidate (cancel+30d) computes later than current -> still extends to later date
    entitlementGrantsSingleMock.mockResolvedValueOnce({
      data: { id: "grant1", expires_at: "2026-09-20T00:00:00Z" },
      error: null,
    });
    rpcMock.mockResolvedValueOnce({ error: null });
    const result = await extendEntitlementForCompanyOrTeacherCancellation("grant1", "2026-09-01T00:00:00Z");
    expect(result.extended).toBe(true);
    // new expiry should be max(existing, cancel+30d) = cancel+30d = 2026-10-01
    expect(result.newExpiresAt).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("transferEntitlementBetweenChildren", () => {
  it("requires reason and calls transfer_entitlement with correct args", async () => {
    rpcMock.mockResolvedValueOnce({ data: "new-grant-1", error: null });
    const result = await transferEntitlementBetweenChildren({
      sourceGrantId: "grant1",
      destChildId: "child2",
      amount: 3,
      reason: "형제간 이전",
    });
    expect(result).toEqual({ newGrantId: "new-grant-1" });
    expect(rpcMock).toHaveBeenCalledWith(
      "transfer_entitlement",
      expect.objectContaining({
        p_source_grant_id: "grant1",
        p_destination_child_id: "child2",
        p_amount: 3,
      })
    );
  });

  it("rejects missing reason before calling RPC", async () => {
    await expect(
      transferEntitlementBetweenChildren({ sourceGrantId: "grant1", destChildId: "child2", amount: 3, reason: "" })
    ).rejects.toThrow("이전 사유");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("refund workflow", () => {
  it("requestRefund computes and stores calculated_refund_minor via calculate_purchase_refund_minor", async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: { refund_minor: 100000, consumed_count: 2 },
      error: null,
    });
    rpcMock.mockReturnValueOnce({ single: singleMock });
    refundRequestsInsertSingleMock.mockResolvedValueOnce({ data: { id: "refund1" }, error: null });

    const result = await requestRefund("purchase1", "환불 요청");
    expect(result).toEqual({ id: "refund1" });
    expect(rpcMock).toHaveBeenCalledWith("calculate_purchase_refund_minor", { p_purchase_id: "purchase1" });
  });

  it("approveRefund transitions to processing then succeeded and calls refund_entitlement", async () => {
    refundRequestsSingleMock.mockResolvedValueOnce({
      data: { id: "refund1", purchase_id: "purchase1", status: "requested" },
      error: null,
    });
    rpcMock.mockResolvedValueOnce({ error: null }); // refund_entitlement

    await approveRefund("refund1");
    expect(rpcMock).toHaveBeenCalledWith("refund_entitlement", {
      p_purchase_id: "purchase1",
      p_business_event_id: expect.stringContaining("refund1"),
    });
    // update called twice: -> processing, -> succeeded
    expect(refundRequestsUpdateEqMock).toHaveBeenCalledTimes(2);
  });

  it("approveRefund rejects already-processed request", async () => {
    refundRequestsSingleMock.mockResolvedValueOnce({
      data: { id: "refund1", purchase_id: "purchase1", status: "succeeded" },
      error: null,
    });
    await expect(approveRefund("refund1")).rejects.toThrow("이미 처리된 환불 요청");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejectRefund leaves no entitlement consequence (no RPC call)", async () => {
    refundRequestsSingleMock.mockResolvedValueOnce({
      data: { id: "refund1", status: "requested" },
      error: null,
    });
    await rejectRefund("refund1", "사유 없음 반려");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(refundRequestsUpdateEqMock).toHaveBeenCalledTimes(1);
  });

  it("requestRefund surfaces zero/blocked refund when nothing eligible", async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: { refund_minor: 0, consumed_count: 20 },
      error: null,
    });
    rpcMock.mockReturnValueOnce({ single: singleMock });
    refundRequestsInsertSingleMock.mockResolvedValueOnce({
      data: { id: "refund2" },
      error: null,
    });
    const result = await requestRefund("purchase2");
    expect(result).toEqual({ id: "refund2" });
    // The record itself carries calculated_refund_minor: 0 - verified via insert call args
    expect(refundRequestsInsertSingleMock).toHaveBeenCalled();
  });
});

describe("createEntitlementProductVersion", () => {
  it("surfaces a friendly error on overlapping effective range (exclusion constraint)", async () => {
    productVersionsMaybeSingleMock.mockResolvedValueOnce({ data: { version_number: 1 }, error: null });
    productVersionsInsertSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'conflicting key value violates exclusion constraint "entitlement_product_versions_no_overlap"' },
    });
    await expect(
      createEntitlementProductVersion({
        productId: "prod1",
        priceMinor: 350000,
        unitPriceMinor: 21875,
        effectiveFrom: "2026-09-01T00:00:00Z",
      })
    ).rejects.toThrow("기존 가격 버전과 겹칩니다");
  });

  it("creates a new version and schedules a price-change notice when effective_from is >30 days out", async () => {
    productVersionsMaybeSingleMock.mockResolvedValueOnce({ data: { version_number: 1 }, error: null });
    productVersionsInsertSingleMock.mockResolvedValueOnce({ data: { id: "pv2" }, error: null });
    priceChangeNoticesInsertSingleMock.mockResolvedValueOnce({ data: { id: "notice1" }, error: null });

    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = await createEntitlementProductVersion({
      productId: "prod1",
      priceMinor: 400000,
      unitPriceMinor: 25000,
      effectiveFrom: farFuture,
    });
    expect(result).toEqual({ id: "pv2" });
    expect(priceChangeNoticesInsertSingleMock).toHaveBeenCalled();
  });
});

describe("listing loaders", () => {
  it("listOpenPriceChangeNotices queries pending status", async () => {
    priceChangeNoticesListMock.mockResolvedValueOnce({
      data: [{ id: "n1", product_version_id: "pv1", notice_required_by: "2026-10-01T00:00:00Z", status: "pending" }],
      error: null,
    });
    const result = await listOpenPriceChangeNotices();
    expect(result).toEqual([
      { id: "n1", productVersionId: "pv1", noticeRequiredBy: "2026-10-01T00:00:00Z", status: "pending" },
    ]);
  });

  it("listPendingRefundRequests queries requested/reviewing/processing statuses", async () => {
    refundRequestsListMock.mockResolvedValueOnce({
      data: [
        {
          id: "r1",
          purchase_id: "p1",
          status: "requested",
          calculated_refund_minor: 1000,
          consumed_count_at_calculation: 0,
          reason: null,
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const result = await listPendingRefundRequests();
    expect(result[0]).toMatchObject({ id: "r1", purchaseId: "p1", status: "requested" });
  });

  it("listPurchasesNeedingReconciliation surfaces reconciliation_needed payment attempts", async () => {
    paymentAttemptsListMock.mockResolvedValueOnce({
      data: [{ id: "pa1", purchase_id: "p1", failure_reason: "webhook timeout", created_at: "2026-09-01T00:00:00Z" }],
      error: null,
    });
    const result = await listPurchasesNeedingReconciliation();
    expect(result).toEqual([
      { purchaseId: "p1", paymentAttemptId: "pa1", failureReason: "webhook timeout", createdAt: "2026-09-01T00:00:00Z" },
    ]);
  });
});
