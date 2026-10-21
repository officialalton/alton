import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

// 실제 Stripe SDK 서명 검증(모킹 없음): 올바른 서명 통과, 변조 본문/잘못된 시크릿/오래된 타임스탬프 거부.
const receiptInsertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      insert: receiptInsertMock,
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }),
}));
vi.mock("@/lib/entitlements", () => ({ createEntitlementGrantForPurchase: vi.fn() }));

const SECRET = "whsec_unit_test_secret";
const stripe = new Stripe("sk_test_dummy");
const body = JSON.stringify({ id: "evt_sig1", type: "customer.created", livemode: false, data: { object: {} } });

function req(payload: string, header: string) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
}

describe("Stripe 웹훅 실제 서명 검증", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("올바른 서명은 200", async () => {
    const { POST } = await import("./route");
    const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
    expect((await POST(req(body, header))).status).toBe(200);
    expect(receiptInsertMock).toHaveBeenCalledTimes(1);
  });

  it("본문 변조는 400 이고 아무것도 기록하지 않는다", async () => {
    const { POST } = await import("./route");
    const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
    expect((await POST(req(body.replace("evt_sig1", "evt_evil"), header))).status).toBe(400);
    expect(receiptInsertMock).not.toHaveBeenCalled();
  });

  it("다른 시크릿으로 서명하면 400", async () => {
    const { POST } = await import("./route");
    const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_other" });
    expect((await POST(req(body, header))).status).toBe(400);
  });

  it("허용 시간(300초)을 넘긴 타임스탬프는 400(리플레이 방어)", async () => {
    const { POST } = await import("./route");
    const header = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect((await POST(req(body, header))).status).toBe(400);
  });
});
