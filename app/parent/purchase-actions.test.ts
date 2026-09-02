import { beforeEach, describe, expect, it, vi } from "vitest";

const guardianLinksMock = vi.fn();
const childLinkMaybeSingleMock = vi.fn();
const contractMaybeSingleMock = vi.fn();

const userSupabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "household_members") {
      return {
        select: () => ({
          eq: () => ({
            eq: (col: string, val: string) => {
              if (col === "role" && val === "guardian") {
                return guardianLinksMock();
              }
              // role='child' 체인: .eq("role","child").in(...).maybeSingle()
              return { in: () => ({ maybeSingle: childLinkMaybeSingleMock }) };
            },
          }),
        }),
      };
    }
    if (table === "contracts") {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: contractMaybeSingleMock }) }) }),
      };
    }
    throw new Error(`unexpected user-client table ${table}`);
  }),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "guardian1" },
    supabase: userSupabaseMock,
  }),
}));

const productMaybeSingleMock = vi.fn();
const versionsMock = vi.fn();
const purchaseInsertSingleMock = vi.fn();
const purchaseUpdateEqMock = vi.fn();
const createSessionMock = vi.fn();

const adminMock = {
  from: vi.fn((table: string) => {
    if (table === "entitlement_products") {
      return { select: () => ({ eq: () => ({ maybeSingle: productMaybeSingleMock }) }) };
    }
    if (table === "entitlement_product_versions") {
      return {
        select: () => ({
          eq: () => ({
            lte: () => ({
              is: () => ({ order: versionsMock }),
            }),
          }),
        }),
      };
    }
    if (table === "purchases") {
      return {
        insert: () => ({ select: () => ({ single: purchaseInsertSingleMock }) }),
        update: () => ({ eq: purchaseUpdateEqMock }),
      };
    }
    throw new Error(`unexpected admin-client table ${table}`);
  }),
};

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => adminMock,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: createSessionMock } } }),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-proto", "https"],
      ["x-forwarded-host", "alton-preview-test.vercel.app"],
    ]),
}));

const validProductVersion = {
  id: "version1",
  version_number: 1,
  price_minor: 350000,
  unit_price_minor: 21875,
  currency: "USD",
  validity_months: 12,
  discount_minor: 87500,
  discount_percent: 20,
  effective_from: "2020-01-01T00:00:00Z",
  effective_until: null,
  discontinued_at: null,
};

describe("createEntitlementCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardianLinksMock.mockResolvedValue({ data: [{ household_id: "hh1" }] });
    childLinkMaybeSingleMock.mockResolvedValue({ data: { household_id: "hh1" } });
    contractMaybeSingleMock.mockResolvedValue({ data: { id: "contract1", status: "active" } });
    productMaybeSingleMock.mockResolvedValue({ data: { id: "prod1", code: "lesson_pack_20", quantity: 20 } });
    versionsMock.mockResolvedValue({ data: [validProductVersion] });
    purchaseInsertSingleMock.mockResolvedValue({ data: { id: "purchase1" }, error: null });
    purchaseUpdateEqMock.mockResolvedValue({ error: null });
    createSessionMock.mockResolvedValue({ id: "cs_123", url: "https://checkout.stripe.com/session123" });
  });

  it("정상 흐름: 가격/할인/정책을 스냅샷하고 Checkout URL을 반환한다", async () => {
    const { createEntitlementCheckoutSession } = await import("./purchase-actions");

    const url = await createEntitlementCheckoutSession({
      childId: "child1",
      entitlementProductCode: "lesson_pack_20",
    });

    expect(url).toBe("https://checkout.stripe.com/session123");
    expect(adminMock.from).toHaveBeenCalledWith("purchases");
    expect(purchaseInsertSingleMock).toHaveBeenCalled();
    const insertCallArgs = (adminMock.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(insertCallArgs.some((c) => c[0] === "purchases")).toBe(true);

    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: expect.objectContaining({ purchase_id: "purchase1", child_id: "child1" }),
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("purchase1") })
    );
    expect(purchaseUpdateEqMock).toHaveBeenCalledWith("id", "purchase1");
  });

  it("Stripe 라인아이템 금액은 package_price_minor + tax(0)이다", async () => {
    const { createEntitlementCheckoutSession } = await import("./purchase-actions");

    await createEntitlementCheckoutSession({ childId: "child1", entitlementProductCode: "lesson_pack_20" });

    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 350000 }) })],
      }),
      expect.anything()
    );
  });

  it("호출자가 이 자녀의 guardian이 아니면 에러를 던진다", async () => {
    childLinkMaybeSingleMock.mockResolvedValue({ data: null });
    const { createEntitlementCheckoutSession } = await import("./purchase-actions");

    await expect(
      createEntitlementCheckoutSession({ childId: "not-my-child", entitlementProductCode: "lesson_pack_20" })
    ).rejects.toThrow("본인 가족 구성원이 아닌 자녀에 대해서는 구매할 수 없습니다.");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("계약이 active가 아니면 구매를 막는다", async () => {
    contractMaybeSingleMock.mockResolvedValue({ data: null });
    const { createEntitlementCheckoutSession } = await import("./purchase-actions");

    await expect(
      createEntitlementCheckoutSession({ childId: "child1", entitlementProductCode: "lesson_pack_20" })
    ).rejects.toThrow("결제 가능한(active) 계약이 없어 구매할 수 없습니다.");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("현재 유효한 가격 버전이 없으면 fail closed로 '가격 정보 없음' 에러를 던진다", async () => {
    versionsMock.mockResolvedValue({ data: [] });
    const { createEntitlementCheckoutSession } = await import("./purchase-actions");

    await expect(
      createEntitlementCheckoutSession({ childId: "child1", entitlementProductCode: "lesson_pack_20" })
    ).rejects.toThrow("가격 정보 없음");
    expect(purchaseInsertSingleMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("effective_until이 지난(만료된) 버전만 있으면 가격 정보 없음으로 취급한다", async () => {
    versionsMock.mockResolvedValue({
      data: [{ ...validProductVersion, effective_until: "2020-06-01T00:00:00Z" }],
    });
    const { createEntitlementCheckoutSession } = await import("./purchase-actions");

    await expect(
      createEntitlementCheckoutSession({ childId: "child1", entitlementProductCode: "lesson_pack_20" })
    ).rejects.toThrow("가격 정보 없음");
  });
});
