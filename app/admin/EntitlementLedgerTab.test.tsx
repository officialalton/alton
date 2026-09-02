import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EntitlementLedgerTab from "./EntitlementLedgerTab";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const createEntitlementProductVersion = vi.fn();
const discontinueEntitlementProductVersion = vi.fn();
const approveRefund = vi.fn();
const rejectRefund = vi.fn();
const extendEntitlementForCompanyOrTeacherCancellation = vi.fn();
const transferEntitlementBetweenChildren = vi.fn();
const adminLookupPurchaseDetail = vi.fn();

vi.mock("./entitlement-actions", () => ({
  createEntitlementProductVersion: (...args: unknown[]) => createEntitlementProductVersion(...args),
  discontinueEntitlementProductVersion: (...args: unknown[]) => discontinueEntitlementProductVersion(...args),
  approveRefund: (...args: unknown[]) => approveRefund(...args),
  rejectRefund: (...args: unknown[]) => rejectRefund(...args),
  extendEntitlementForCompanyOrTeacherCancellation: (...args: unknown[]) =>
    extendEntitlementForCompanyOrTeacherCancellation(...args),
  transferEntitlementBetweenChildren: (...args: unknown[]) => transferEntitlementBetweenChildren(...args),
  adminLookupPurchaseDetail: (...args: unknown[]) => adminLookupPurchaseDetail(...args),
}));

const baseProps = {
  products: [{ id: "prod1", code: "lesson_pack_20", quantity: 20 }],
  productVersions: [
    {
      id: "pv1",
      entitlementProductId: "prod1",
      productCode: "lesson_pack_20",
      versionNumber: 1,
      priceMinor: 480000,
      unitPriceMinor: 24000,
      currency: "USD",
      validityMonths: 12,
      discountMinor: 0,
      discountPercent: 0,
      effectiveFrom: "2026-01-01T00:00:00Z",
      effectiveUntil: null,
      discontinuedAt: null,
    },
  ],
  openPriceChangeNotices: [
    { id: "n1", productVersionId: "pv1", noticeRequiredBy: "2026-10-01T00:00:00Z", status: "pending" },
  ],
  pendingRefundRequests: [
    {
      id: "r1",
      purchaseId: "purchase1",
      status: "requested",
      calculatedRefundMinor: 12000,
      consumedCountAtCalculation: 2,
      reason: "일정 변경",
      createdAt: "2026-08-01T00:00:00Z",
    },
  ],
  purchasesNeedingReconciliation: [
    {
      purchaseId: "purchase2",
      paymentAttemptId: "attempt1",
      failureReason: "card_declined",
      createdAt: "2026-08-02T00:00:00Z",
    },
  ],
};

describe("EntitlementLedgerTab", () => {
  it("상품·가격 버전 서브탭을 기본으로 보여준다", () => {
    render(<EntitlementLedgerTab {...baseProps} />);
    expect(screen.getByText("lesson_pack_20 v1", { exact: false })).toBeInTheDocument();
  });

  it("가격 버전 생성 버튼을 누르면 올바른 인자로 액션을 호출한다", async () => {
    createEntitlementProductVersion.mockResolvedValueOnce({ id: "pv2" });
    render(<EntitlementLedgerTab {...baseProps} />);

    fireEvent.change(screen.getByPlaceholderText("총 가격(minor)"), { target: { value: "500000" } });
    fireEvent.change(screen.getByPlaceholderText("단가(minor)"), { target: { value: "25000" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "prod1" } });
    fireEvent.change(screen.getByPlaceholderText("유효기간(개월)"), { target: { value: "12" } });
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-12-01T00:00" } });

    fireEvent.click(screen.getByText("가격 버전 생성"));

    await waitFor(() =>
      expect(createEntitlementProductVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "prod1",
          priceMinor: 500000,
          unitPriceMinor: 25000,
          validityMonths: 12,
          effectiveFrom: "2026-12-01T00:00",
        })
      )
    );
  });

  it("판매 중단 버튼을 누르면 discontinueEntitlementProductVersion을 호출한다", async () => {
    discontinueEntitlementProductVersion.mockResolvedValueOnce(undefined);
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("판매 중단"));
    await waitFor(() => expect(discontinueEntitlementProductVersion).toHaveBeenCalledWith("pv1"));
  });

  it("가격 버전 생성 실패 시 친화적 에러 메시지를 보여준다", async () => {
    createEntitlementProductVersion.mockRejectedValueOnce(
      new Error("이 상품의 유효 기간이 기존 가격 버전과 겹칩니다. effectiveFrom/effectiveUntil을 조정해주세요.")
    );
    render(<EntitlementLedgerTab {...baseProps} />);

    fireEvent.change(screen.getByPlaceholderText("총 가격(minor)"), { target: { value: "500000" } });
    fireEvent.change(screen.getByPlaceholderText("단가(minor)"), { target: { value: "25000" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "prod1" } });
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-12-01T00:00" } });
    fireEvent.click(screen.getByText("가격 버전 생성"));

    await waitFor(() =>
      expect(screen.getByText("이 상품의 유효 기간이 기존 가격 버전과 겹칩니다. effectiveFrom/effectiveUntil을 조정해주세요.")).toBeInTheDocument()
    );
  });

  it("30일 고지 대상 서브탭에서 대기 중인 고지를 보여준다", () => {
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("30일 고지 대상"));
    expect(screen.getByText("상품 버전: pv1", { exact: false })).toBeInTheDocument();
  });

  it("결제 실패·대사 서브탭에서 대사 필요 항목을 보여준다", () => {
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("결제 실패·대사"));
    expect(screen.getByText("구매 ID: purchase2", { exact: false })).toBeInTheDocument();
  });

  it("환불 요청 서브탭에서 승인 버튼을 누르면 approveRefund를 호출하고 목록에서 제거한다", async () => {
    approveRefund.mockResolvedValueOnce(undefined);
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("환불 요청"));
    expect(screen.getByText("구매 ID: purchase1", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByText("승인"));
    await waitFor(() => expect(approveRefund).toHaveBeenCalledWith("r1"));
    await waitFor(() =>
      expect(screen.queryByText("구매 ID: purchase1", { exact: false })).not.toBeInTheDocument()
    );
  });

  it("환불 요청 서브탭에서 거부 사유를 입력하고 거부하면 rejectRefund를 호출한다", async () => {
    rejectRefund.mockResolvedValueOnce(undefined);
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("환불 요청"));
    fireEvent.change(screen.getByPlaceholderText("거부 사유"), { target: { value: "중복 요청" } });
    fireEvent.click(screen.getByText("거부"));
    await waitFor(() => expect(rejectRefund).toHaveBeenCalledWith("r1", "중복 요청"));
  });

  it("환불 승인 실패 시 에러 메시지를 보여준다", async () => {
    approveRefund.mockRejectedValueOnce(new Error("이미 처리된 환불 요청입니다(현재 상태: succeeded)."));
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("환불 요청"));
    fireEvent.click(screen.getByText("승인"));
    await waitFor(() =>
      expect(screen.getByText("이미 처리된 환불 요청입니다(현재 상태: succeeded).")).toBeInTheDocument()
    );
  });

  it("조정·연장·이전 서브탭에서 연장 실행 시 올바른 인자로 호출한다", async () => {
    extendEntitlementForCompanyOrTeacherCancellation.mockResolvedValueOnce({
      extended: true,
      newExpiresAt: "2026-11-01T00:00:00Z",
    });
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("조정·연장·이전"));

    fireEvent.change(screen.getByPlaceholderText("grant ID"), { target: { value: "grant1" } });
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-10-01T00:00" } });
    fireEvent.click(screen.getByText("연장 실행"));

    await waitFor(() =>
      expect(extendEntitlementForCompanyOrTeacherCancellation).toHaveBeenCalledWith(
        "grant1",
        "2026-10-01T00:00"
      )
    );
    expect(await screen.findByText("연장됨 — 새 만료일: 2026-11-01T00:00:00Z", { exact: false })).toBeInTheDocument();
  });

  it("조정·연장·이전 서브탭에서 이전 실행 시 올바른 인자로 호출한다", async () => {
    transferEntitlementBetweenChildren.mockResolvedValueOnce({ newGrantId: "grant2" });
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("조정·연장·이전"));

    fireEvent.change(screen.getByPlaceholderText("source grant ID"), { target: { value: "grant1" } });
    fireEvent.change(screen.getByPlaceholderText("destination child ID"), { target: { value: "child1" } });
    fireEvent.change(screen.getByPlaceholderText("수량"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("사유(필수)"), { target: { value: "가족 요청" } });
    fireEvent.click(screen.getByText("이전 실행"));

    await waitFor(() =>
      expect(transferEntitlementBetweenChildren).toHaveBeenCalledWith({
        sourceGrantId: "grant1",
        destChildId: "child1",
        amount: 5,
        reason: "가족 요청",
      })
    );
  });

  it("구매 상세 조회 서브탭에서 조회 버튼을 누르면 adminLookupPurchaseDetail을 호출하고 결과를 보여준다", async () => {
    adminLookupPurchaseDetail.mockResolvedValueOnce({
      purchaseId: "purchase1",
      householdId: "hh1",
      childId: "child1",
      contractId: "contract1",
      contractVersionNumber: 1,
      productCode: "lesson_pack_20",
      productVersionId: "pv1",
      quantity: 20,
      unitPriceMinor: 24000,
      packagePriceMinor: 480000,
      discountMinor: 0,
      discountPercent: 0,
      taxMinor: 0,
      totalMinor: 480000,
      currency: "USD",
      validityMonths: 12,
      expiresAt: "2027-01-01T00:00:00Z",
      pricePolicyVersion: "v1",
      refundPolicyVersion: "v1",
      termsVersion: "v1",
      status: "confirmed",
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      createdAt: "2026-08-01T00:00:00Z",
      confirmedAt: "2026-08-01T00:10:00Z",
    });

    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("구매 상세 조회"));
    fireEvent.change(screen.getByPlaceholderText("구매(purchase) ID"), { target: { value: "purchase1" } });
    fireEvent.click(screen.getByText("조회"));

    await waitFor(() => expect(adminLookupPurchaseDetail).toHaveBeenCalledWith("purchase1"));
    expect(await screen.findByText("Stripe 세션 ID: cs_123", { exact: false })).toBeInTheDocument();
  });

  it("구매 상세 조회 실패 시 에러 메시지를 보여준다", async () => {
    adminLookupPurchaseDetail.mockResolvedValueOnce(null);
    render(<EntitlementLedgerTab {...baseProps} />);
    fireEvent.click(screen.getByText("구매 상세 조회"));
    fireEvent.change(screen.getByPlaceholderText("구매(purchase) ID"), { target: { value: "nope" } });
    fireEvent.click(screen.getByText("조회"));

    await waitFor(() => expect(screen.getByText("존재하지 않는 구매 ID입니다.")).toBeInTheDocument());
  });
});
