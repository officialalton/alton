import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const purchaseInsertSelectSingle = vi.fn().mockResolvedValue({ data: { id: "purchase1" }, error: null });
const txInsertMock = vi.fn().mockResolvedValue({ error: null });
const packageSingleMock = vi.fn().mockResolvedValue({
  data: { credit_count: 10, price_usd: 1200 },
  error: null,
});
const studentSelectSingleMock = vi.fn().mockResolvedValue({ data: { credit_balance: 4 } });
const studentUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const receiptMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });
const receiptInsertMock = vi.fn().mockResolvedValue({ error: null });
const receiptUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

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
  if (table === "credit_packages") {
    return { select: () => ({ eq: () => ({ single: packageSingleMock }) }) };
  }
  if (table === "credit_purchases") {
    return {
      insert: () => ({ select: () => ({ single: purchaseInsertSelectSingle }) }),
    };
  }
  if (table === "credit_transactions") {
    return { insert: txInsertMock };
  }
  if (table === "students") {
    return {
      select: () => ({ eq: () => ({ single: studentSelectSingleMock }) }),
      update: () => ({ eq: studentUpdateEqMock }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

// constructEvent를 실제 HMAC 검증 없이 요청 본문을 그대로 파싱하는 것으로
// mock한다(DocuSign 웹훅 테스트와 동일한 접근 — 서명 검증 자체는 Stripe SDK의
// 책임이라 여기서 재검증하지 않고, "서명이 없거나 secret이 없으면 절대
// constructEvent를 부르지 않고 401을 반환한다"는 라우트 쪽 fail-closed
// 분기만 검증한다). constructEventMock을 별도로 두어 "서명이 틀렸다"는
// 시나리오는 mockImplementationOnce로 throw하게 만든다.
const constructEventMock = vi.fn((rawBody: string) => JSON.parse(rawBody));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}));

let eventIdCounter = 0;
function makeRequest(payload: Record<string, unknown>, opts: { withSignature?: boolean } = {}) {
  const withSignature = opts.withSignature ?? true;
  eventIdCounter += 1;
  const body = { id: `evt_${eventIdCounter}`, ...payload };
  const headers: Record<string, string> = {};
  if (withSignature) {
    headers["stripe-signature"] = "t=1,v1=fake";
  }
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/stripe (레거시 credit_packages 플로우)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEventMock.mockImplementation((rawBody: string) => JSON.parse(rawBody));
    purchaseInsertSelectSingle.mockResolvedValue({ data: { id: "purchase1" }, error: null });
    txInsertMock.mockResolvedValue({ error: null });
    packageSingleMock.mockResolvedValue({ data: { credit_count: 10, price_usd: 1200 }, error: null });
    studentSelectSingleMock.mockResolvedValue({ data: { credit_balance: 4 } });
    studentUpdateEqMock.mockResolvedValue({ error: null });
    receiptMaybeSingleMock.mockResolvedValue({ data: null });
    receiptInsertMock.mockResolvedValue({ error: null });
    receiptUpdateEqMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("STRIPE_WEBHOOK_SECRET이 없으면 서명 헤더가 있어도 401을 반환한다(fail-closed)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", metadata: { student_id: "s1", package_id: "p1" } } },
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("서명 헤더가 없으면 401을 반환한다(fail-closed)", async () => {
    const { POST } = await import("./route");
    const request = makeRequest(
      {
        type: "checkout.session.completed",
        data: { object: { id: "cs_123", metadata: { student_id: "s1", package_id: "p1" } } },
      },
      { withSignature: false }
    );

    const res = await POST(request);
    expect(res.status).toBe(401);
  });

  it("서명 검증에 실패하면 400을 반환한다", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("signature mismatch");
    });
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", metadata: { student_id: "s1", package_id: "p1" } } },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("checkout.session.completed 이벤트를 받으면 수업권을 지급한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          payment_intent: "pi_123",
          amount_total: 120000,
          metadata: { student_id: "s1", package_id: "p1" },
        },
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("credit_purchases");
    expect(txInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: "s1", type: "purchase", amount: 10 })
    );
    expect(studentUpdateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("checkout.session.completed가 아닌(그리고 R4 처리 대상도 아닌) 이벤트는 reconciliation 없이 무시한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ type: "payment_intent.created", data: { object: {} } });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("metadata가 없으면 400을 반환한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", metadata: {} } },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(txInsertMock).not.toHaveBeenCalled();
  });
});
