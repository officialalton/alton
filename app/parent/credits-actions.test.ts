import { beforeEach, describe, expect, it, vi } from "vitest";

const packageSingleMock = vi.fn();
const supabaseMock = {
  from: vi.fn(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ single: packageSingleMock }) }) }),
  })),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "parent1" },
    profile: { role: "parent", name: "김민지" },
    supabase: supabaseMock,
  }),
}));

const createSessionMock = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: createSessionMock } } }),
}));

describe("createCreditCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    packageSingleMock.mockResolvedValue({
      data: { id: "p1", name: "10장", credit_count: 10, price_usd: 1200 },
    });
    createSessionMock.mockResolvedValue({ url: "https://checkout.stripe.com/session123" });
  });

  it("패키지 정보로 Stripe Checkout 세션을 만들고 url을 반환한다", async () => {
    const { createCreditCheckoutSession } = await import("./credits-actions");
    const url = await createCreditCheckoutSession("p1", "s1");

    expect(url).toBe("https://checkout.stripe.com/session123");
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: { student_id: "s1", package_id: "p1", parent_id: "parent1" },
      })
    );
  });

  it("존재하지 않는 패키지면 에러를 던진다", async () => {
    packageSingleMock.mockResolvedValue({ data: null });
    const { createCreditCheckoutSession } = await import("./credits-actions");
    await expect(createCreditCheckoutSession("bad", "s1")).rejects.toThrow(
      "존재하지 않는 수업권 패키지입니다."
    );
  });
});
