import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// R4 entitlement 구매 플로우 전용 웹훅 테스트. 레거시 credit_packages 플로우는
// route.test.ts에서 별도로 검증한다.

const receiptMaybeSingleMock = vi.fn();
const receiptInsertMock = vi.fn().mockResolvedValue({ error: null });
const receiptUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const paymentAttemptInsertMock = vi.fn().mockResolvedValue({ error: null });
const purchaseUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const purchaseSelectMaybeSingleMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "external_event_receipts") {
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: receiptMaybeSingleMock }) }),
      }),
      insert: receiptInsertMock,
      update: () => ({ eq: () => ({ eq: receiptUpdateEqMock }) }),
    };
  }
  if (table === "payment_attempts") {
    return { insert: paymentAttemptInsertMock };
  }
  if (table === "purchases") {
    return {
      update: () => ({ eq: purchaseUpdateEqMock }),
      select: () => ({ eq: () => ({ maybeSingle: purchaseSelectMaybeSingleMock }) }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const constructEventMock = vi.fn((rawBody: string) => JSON.parse(rawBody));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}));

const createGrantMock = vi.fn();
vi.mock("@/lib/entitlements", () => ({
  createEntitlementGrantForPurchase: (...args: unknown[]) => createGrantMock(...args),
}));

let eventIdCounter = 0;
function makeRequest(payload: Record<string, unknown>, eventId?: string) {
  eventIdCounter += 1;
  const body = { id: eventId ?? `evt_${eventIdCounter}`, ...payload };
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=fake" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/stripe (R4 entitlement 구매 플로우)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEventMock.mockImplementation((rawBody: string) => JSON.parse(rawBody));
    receiptMaybeSingleMock.mockResolvedValue({ data: null });
    receiptInsertMock.mockResolvedValue({ error: null });
    receiptUpdateEqMock.mockResolvedValue({ error: null });
    paymentAttemptInsertMock.mockResolvedValue({ error: null });
    purchaseUpdateEqMock.mockResolvedValue({ error: null });
    purchaseSelectMaybeSingleMock.mockResolvedValue({ data: null });
    createGrantMock.mockResolvedValue({ grantId: "grant1", created: true });
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("checkout.session.completed(purchase_id 포함) → payment_attempts succeeded + entitlement grant + purchases succeeded", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_intent: "pi_1",
          metadata: { purchase_id: "purchase1", child_id: "child1", household_id: "hh1" },
        },
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(paymentAttemptInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ purchase_id: "purchase1", status: "succeeded" })
    );
    expect(createGrantMock).toHaveBeenCalledWith(expect.anything(), "purchase1");
    expect(purchaseUpdateEqMock).toHaveBeenCalledWith("id", "purchase1");
  });

  it("가장 중요: 같은 event.id로 두 번 배달돼도 grant는 정확히 한 번만 생성된다(중복 웹훅 no-op)", async () => {
    const { POST } = await import("./route");
    const request1 = makeRequest(
      {
        type: "checkout.session.completed",
        data: { object: { id: "cs_1", payment_intent: "pi_1", metadata: { purchase_id: "purchase1" } } },
      },
      "evt_dup_1"
    );

    receiptMaybeSingleMock.mockResolvedValueOnce({ data: null });
    const first = await POST(request1);
    expect(first.status).toBe(200);
    expect(createGrantMock).toHaveBeenCalledTimes(1);

    // 두 번째 배달: 같은 event.id, idempotency 테이블이 이미 processed로 응답.
    receiptMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "receipt1", processed_at: "2026-09-01T00:00:00Z" },
    });
    const request2 = makeRequest(
      {
        type: "checkout.session.completed",
        data: { object: { id: "cs_1", payment_intent: "pi_1", metadata: { purchase_id: "purchase1" } } },
      },
      "evt_dup_1"
    );
    const second = await POST(request2);
    const secondBody = (await second.json()) as { skipped?: string };

    expect(second.status).toBe(200);
    expect(secondBody.skipped).toBe("already processed");
    // grant 생성이 두 번째 배달에서는 전혀 호출되지 않는다(웹훅 레벨 idempotency로 완전 차단).
    expect(createGrantMock).toHaveBeenCalledTimes(1);
    expect(paymentAttemptInsertMock).toHaveBeenCalledTimes(1);
  });

  it("결제 실패(payment_intent.payment_failed)는 grant를 만들지 않고 purchases를 failed로 남긴다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "payment_intent.payment_failed",
      data: {
        object: { id: "pi_1", metadata: { purchase_id: "purchase1" }, last_payment_error: { message: "카드 거절" } },
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(createGrantMock).not.toHaveBeenCalled();
    expect(paymentAttemptInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ purchase_id: "purchase1", status: "failed" })
    );
    expect(purchaseUpdateEqMock).toHaveBeenCalledWith("id", "purchase1");
  });

  it("checkout.session.expired는 grant를 만들지 않고 purchases를 cancelled로 남긴다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.expired",
      data: { object: { id: "cs_1", payment_intent: null, metadata: { purchase_id: "purchase1" } } },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(createGrantMock).not.toHaveBeenCalled();
    expect(paymentAttemptInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ purchase_id: "purchase1", status: "cancelled" })
    );
  });

  it("우리가 모르는/모호한 이벤트 타입은 reconciliation_needed로 남기고 성공으로 추측하지 않는다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "some.unknown.event",
      data: { object: { id: "obj_1", metadata: { purchase_id: "purchase1" } } },
    });

    const res = await POST(request);
    const body = (await res.json()) as { skipped?: string };
    expect(res.status).toBe(200);
    expect(body.skipped).toContain("unhandled event");
    expect(createGrantMock).not.toHaveBeenCalled();
    expect(paymentAttemptInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ purchase_id: "purchase1", status: "reconciliation_needed" })
    );
    expect(purchaseUpdateEqMock).toHaveBeenCalledWith("id", "purchase1");
  });

  it("purchase_id를 특정할 수 없는 모호한 이벤트는 receipt만 남기고 아무 것도 갱신하지 않는다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "some.unknown.event",
      data: { object: { id: "obj_1" } },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(paymentAttemptInsertMock).not.toHaveBeenCalled();
    expect(purchaseUpdateEqMock).not.toHaveBeenCalled();
  });

  it("charge.dispute.created(분쟁)는 purchases를 disputed로 남기되 entitlement를 자동 회수하지 않는다", async () => {
    purchaseSelectMaybeSingleMock.mockResolvedValue({ data: { id: "purchase1" } });
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "charge.dispute.created",
      data: { object: { id: "dp_1", payment_intent: "pi_1" } },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(purchaseUpdateEqMock).toHaveBeenCalledWith("id", "purchase1");
    expect(createGrantMock).not.toHaveBeenCalled();
  });

  it("서명/secret이 없으면 401(fail-closed) — R4 이벤트도 예외 없음", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", metadata: { purchase_id: "purchase1" } } },
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(createGrantMock).not.toHaveBeenCalled();
  });
});
