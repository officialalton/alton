import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const purchaseInsertSelectSingle = vi.fn().mockResolvedValue({ data: { id: "purchase1" }, error: null });
const txInsertMock = vi.fn().mockResolvedValue({ error: null });
const packageSingleMock = vi.fn().mockResolvedValue({
  data: { credit_count: 10, price_usd: 1200 },
  error: null,
});
const studentSelectSingleMock = vi.fn().mockResolvedValue({ data: { credit_balance: 4 } });
const studentUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
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

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: vi.fn() } }),
}));

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purchaseInsertSelectSingle.mockResolvedValue({ data: { id: "purchase1" }, error: null });
    txInsertMock.mockResolvedValue({ error: null });
    packageSingleMock.mockResolvedValue({ data: { credit_count: 10, price_usd: 1200 }, error: null });
    studentSelectSingleMock.mockResolvedValue({ data: { credit_balance: 4 } });
    studentUpdateEqMock.mockResolvedValue({ error: null });
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("checkout.session.completed 이벤트를 받으면 수업권을 지급한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_123",
            payment_intent: "pi_123",
            amount_total: 120000,
            metadata: { student_id: "s1", package_id: "p1" },
          },
        },
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("credit_purchases");
    expect(txInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: "s1", type: "purchase", amount: 10 })
    );
    expect(studentUpdateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("checkout.session.completed가 아닌 이벤트는 무시한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "payment_intent.created", data: { object: {} } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("metadata가 없으면 400을 반환한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { id: "cs_123", metadata: {} } },
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(txInsertMock).not.toHaveBeenCalled();
  });
});
