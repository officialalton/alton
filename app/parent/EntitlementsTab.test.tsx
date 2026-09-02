import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EntitlementsTab from "./EntitlementsTab";
import type { ParentEntitlementsData } from "./entitlements-data";
import { createEntitlementCheckoutSession } from "./purchase-actions";

vi.mock("./purchase-actions", () => ({
  createEntitlementCheckoutSession: vi.fn(),
}));

const baseData: ParentEntitlementsData = {
  prices: [
    {
      productCode: "lesson_pack_1",
      productName: "단건 수업권",
      quantity: 1,
      unitPriceMinor: 21875,
      packagePriceMinor: 21875,
      discountMinor: 0,
      discountPercent: 0,
      currency: "USD",
      validityMonths: 12,
      versionNumber: 1,
    },
    {
      productCode: "lesson_pack_20",
      productName: "20회 패키지 수업권",
      quantity: 20,
      unitPriceMinor: 21875,
      packagePriceMinor: 350000,
      discountMinor: 87500,
      discountPercent: 20,
      currency: "USD",
      validityMonths: 12,
      versionNumber: 1,
    },
  ],
  children: [
    {
      childId: "s1",
      childName: "지훈",
      eligibleForPurchase: true,
      ineligibleReason: null,
      totalRemaining: 5,
      nearestExpiry: "2027-01-01T00:00:00.000Z",
      balances: [{ grantId: "g1", remaining: 5, expiresAt: "2027-01-01T00:00:00.000Z" }],
      purchases: [
        {
          purchaseId: "pu1",
          childId: "s1",
          contractId: "c1",
          contractVersionNumber: 2,
          productCode: "lesson_pack_20",
          productName: "20회 패키지 수업권",
          lessonTypeLabel: "정규 1:1 수업",
          lessonDurationMinutes: 120,
          quantity: 20,
          unitPriceMinor: 21875,
          packagePriceMinor: 350000,
          discountMinor: 87500,
          discountPercent: 20,
          taxMinor: 0,
          totalMinor: 350000,
          currency: "USD",
          validityMonths: 12,
          expiresAt: "2027-01-01T00:00:00.000Z",
          pricePolicyVersion: "1",
          refundPolicyVersion: "r4-2026-09-01",
          termsVersion: "r4-2026-09-01",
          status: "confirmed",
          stripeCheckoutSessionId: "cs_test_1",
          stripePaymentIntentId: "pi_test_1",
          createdAt: "2026-09-01T00:00:00.000Z",
          confirmedAt: "2026-09-01T00:05:00.000Z",
        },
      ],
    },
    {
      childId: "s2",
      childName: "이서아",
      eligibleForPurchase: false,
      ineligibleReason: "결제 가능한(active) 계약이 없습니다.",
      totalRemaining: 0,
      nearestExpiry: null,
      balances: [],
      purchases: [],
    },
  ],
};

describe("EntitlementsTab", () => {
  it("현재 가격과 할인율을 보여준다", () => {
    render(<EntitlementsTab data={baseData} />);
    expect(screen.getByText("단건 수업권")).toBeInTheDocument();
    expect(screen.getByText("20회 패키지 수업권")).toBeInTheDocument();
    expect(screen.getByText(/20% 할인/)).toBeInTheDocument();
  });

  it("자격 있는 자녀는 선택 가능하고 자격 없는 자녀는 비활성화된다", () => {
    render(<EntitlementsTab data={baseData} />);
    const eligibleButton = screen.getAllByText(/지훈/)[0].closest("button");
    const ineligibleButton = screen.getAllByText(/이서아/)[0].closest("button");
    expect(eligibleButton).not.toBeDisabled();
    expect(ineligibleButton).toBeDisabled();
  });

  it("구매하기를 누르면 체크아웃 세션을 만들고 이동한다", async () => {
    vi.mocked(createEntitlementCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );
    const originalLocation = window.location;
    // @ts-expect-error - jsdom 환경에서 location.href 대입을 검증하기 위해 교체
    delete window.location;
    // @ts-expect-error - 위와 동일한 이유로 부분 객체를 location에 대입
    window.location = { ...originalLocation, href: "" };

    render(<EntitlementsTab data={baseData} />);
    fireEvent.click(screen.getByText("구매하기"));

    await waitFor(() => {
      expect(createEntitlementCheckoutSession).toHaveBeenCalledWith({
        childId: "s1",
        entitlementProductCode: "lesson_pack_1",
      });
    });
    expect(window.location.href).toBe("https://checkout.stripe.com/session123");

    // @ts-expect-error - 테스트용으로 교체했던 location 원복
    window.location = originalLocation;
  });

  it("체크아웃 세션 생성 실패 시 오류 메시지를 보여준다", async () => {
    vi.mocked(createEntitlementCheckoutSession).mockRejectedValue(
      new Error("결제 가능한(active) 계약이 없어 구매할 수 없습니다.")
    );
    render(<EntitlementsTab data={baseData} />);
    fireEvent.click(screen.getByText("구매하기"));

    await waitFor(() => {
      expect(
        screen.getByText("결제 가능한(active) 계약이 없어 구매할 수 없습니다.")
      ).toBeInTheDocument();
    });
  });

  it("잔여량과 만료일을 보여준다", () => {
    render(<EntitlementsTab data={baseData} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getAllByText(/가장 빠른 만료일:/).length).toBeGreaterThan(0);
    expect(screen.getByText("잔여 5회")).toBeInTheDocument();
  });

  it("구매 내역을 펼치면 영수증 필드를 보여준다", () => {
    render(<EntitlementsTab data={baseData} />);
    fireEvent.click(screen.getByText(/20회 패키지 수업권 ·/));
    expect(screen.getByText("주문/결제 ID")).toBeInTheDocument();
    expect(screen.getByText("pu1")).toBeInTheDocument();
    expect(screen.getByText("결제대행사 거래 ID")).toBeInTheDocument();
    expect(screen.getByText("pi_test_1")).toBeInTheDocument();
  });

  it("purchaseStatus가 success면 완료 안내를 보여준다", () => {
    render(<EntitlementsTab data={baseData} purchaseStatus="success" />);
    expect(screen.getByText(/결제 완료, 수업권이 지급되었습니다/)).toBeInTheDocument();
  });
});
