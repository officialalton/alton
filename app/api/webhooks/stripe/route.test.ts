import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const packageSingleMock = vi.fn().mockResolvedValue({
  data: { credit_count: 10, price_usd: 1200 },
  error: null,
});

const receiptMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });
const receiptInsertMock = vi.fn().mockResolvedValue({ error: null });
const receiptUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const rpcMock = vi.fn().mockResolvedValue({ data: { created: true }, error: null });
const issueUpsertMock = vi.fn().mockResolvedValue({ error: null });

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
  if (table === "payment_webhook_issues") {
    return { upsert: issueUpsertMock };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
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
    rpcMock.mockResolvedValue({ data: { created: true }, error: null });
    packageSingleMock.mockResolvedValue({ data: { credit_count: 10, price_usd: 1200 }, error: null });
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
    expect(rpcMock).not.toHaveBeenCalled();
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

  const paidSession = {
    id: "cs_123",
    payment_intent: "pi_123",
    amount_total: 120000,
    currency: "usd",
    payment_status: "paid",
    metadata: { student_id: "s1", package_id: "p1" },
  };

  it("paid + 금액 일치면 단일 트랜잭션 RPC 로 session 기준 1회 지급한다", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ type: "checkout.session.completed", data: { object: paidSession } }));
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("grant_legacy_credit_purchase", {
      p_session_id: "cs_123",
      p_student_id: "s1",
      p_package_id: "p1",
      p_payment_intent: "pi_123",
    });
  });

  it("RPC 가 실패하면 500 이고 receipt 를 처리 완료로 표시하지 않는다(Stripe 재시도 → 중복 지급 없음은 RPC unique 가 보장)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ type: "checkout.session.completed", data: { object: paidSession } }));
    expect(res.status).toBe(500);
    expect(receiptUpdateEqMock).not.toHaveBeenCalled();
  });

  it("서로 다른 event 가 같은 session 을 가리켜도 매번 같은 session 키로 RPC 를 호출한다(멱등은 DB unique)", async () => {
    const { POST } = await import("./route");
    await POST(makeRequest({ type: "checkout.session.completed", data: { object: paidSession } }));
    await POST(makeRequest({ type: "checkout.session.async_payment_succeeded", data: { object: paidSession } }));
    expect(rpcMock.mock.calls.map((c) => c[1].p_session_id)).toEqual(["cs_123", "cs_123"]);
  });

  it("금액 불일치면 지급하지 않고 이상 대장에 기록한다", async () => {
    const { POST } = await import("./route");
    await POST(
      makeRequest({ type: "checkout.session.completed", data: { object: { ...paidSession, amount_total: 100 } } })
    );
    expect(rpcMock).not.toHaveBeenCalled();
    expect(issueUpsertMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "legacy_amount_mismatch" }), expect.anything());
  });

  it("unpaid 면 지급하지 않는다", async () => {
    const { POST } = await import("./route");
    await POST(
      makeRequest({ type: "checkout.session.completed", data: { object: { ...paidSession, payment_status: "unpaid" } } })
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("checkout.session.completed가 아닌(그리고 R4 처리 대상도 아닌) 이벤트는 reconciliation 없이 무시한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ type: "payment_intent.created", data: { object: {} } });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("metadata가 없으면 400을 반환한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", metadata: {} } },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
