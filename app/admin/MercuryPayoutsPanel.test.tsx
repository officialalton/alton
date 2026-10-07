// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MercuryPayoutRow } from "./mercury-payout-actions";

const row = (over: Partial<MercuryPayoutRow>): MercuryPayoutRow => ({
  attemptId: "a1", settlementId: "s1", recipientId: "p1", recipientName: "Test Teacher", recipientKind: "teacher",
  periodStart: "2026-10-01", periodEnd: "2026-10-15", paymentDeadline: "2026-10-26", scheduledTransferDate: "2026-10-21",
  provider: "mercury", rail: "ach", kind: "normal", attemptNo: 1, status: "queued", manualExecution: false,
  requestedAmountMinor: 50000, requestedCurrency: "USD", contractualAmountMinor: 50000, contractualCurrency: "USD",
  bankName: "Test Bank", accountLast4: "1234", recipientLinkStatus: "verified", approvedAt: "2026-10-10T00:00:00Z", approvalInvalidated: false,
  sentAt: null, receivedConfirmedAt: null, actualUsdPrincipalMinor: null, actualUsdFeeMinor: null, actualUsdTotalDebitMinor: null,
  providerTransactionId: null, trackingUrl: null, receiptUrl: null, reasons: [], reconciliationFlag: "pending", failureReason: null, returnReason: null, ...over,
});

const list = vi.fn();
vi.mock("./mercury-payout-actions", () => ({
  listMercuryPayoutsAction: (...a: unknown[]) => list(...a),
  approvePayoutAttemptAction: vi.fn(), confirmReceiptAction: vi.fn(), createResendAttemptAction: vi.fn(), failOrCancelAttemptAction: vi.fn(),
  linkTransactionAction: vi.fn(), markManualAttemptSentAction: vi.fn(), recordActualsAction: vi.fn(), recordReturnAction: vi.fn(), requestPayoutAttemptAction: vi.fn(),
}));
import MercuryPayoutsPanel from "./MercuryPayoutsPanel";

afterEach(() => {
  cleanup();
  list.mockReset();
});

describe("MercuryPayoutsPanel", () => {
  it("스위치가 닫혀 있으면 이유를 보여 주고 Mercury 요청 버튼을 비활성화한다(영어 화면)", async () => {
    list.mockResolvedValue({ ok: true, data: { rows: [row({})], gateOpen: false, mercuryEnabled: false } });
    render(<MercuryPayoutsPanel />);
    await waitFor(() => expect(screen.getByTestId("mercury-row")).toBeTruthy());
    expect(screen.getByTestId("mercury-switches").textContent).toContain("Disbursement gate: closed");
    expect((screen.getByRole("button", { name: "Request via Mercury" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Download reconciliation file")).toBeTruthy();
  });
  it("sent는 수취 확인 전까지 '지급 완료'로 표시하지 않는다", async () => {
    list.mockResolvedValue({ ok: true, data: { rows: [row({ status: "sent", sentAt: "2026-10-20T00:00:00Z", providerTransactionId: "tx1" })], gateOpen: true, mercuryEnabled: true } });
    render(<MercuryPayoutsPanel />);
    await waitFor(() => expect(screen.getByTestId("mercury-status").textContent).toBe("Sent (receipt not confirmed)"));
    expect(screen.getByText(/receipt not confirmed yet/)).toBeTruthy();
  });
  it("KRW 정산은 원화 금액과 USD 출금을 따로 표시한다", async () => {
    list.mockResolvedValue({
      ok: true,
      data: { rows: [row({ requestedCurrency: "KRW", contractualCurrency: "KRW", requestedAmountMinor: 1500000, manualExecution: true, rail: "international_wire", actualUsdPrincipalMinor: 1100000, actualUsdFeeMinor: 11000, actualUsdTotalDebitMinor: 1111000 })], gateOpen: false, mercuryEnabled: false },
    });
    render(<MercuryPayoutsPanel />);
    await waitFor(() => expect(screen.getByTestId("mercury-row")).toBeTruthy());
    const text = screen.getByTestId("mercury-row").textContent ?? "";
    expect(text).toContain("KRW 1,500,000");
    expect(text).toContain("USD debit: USD 11,000.00 + fees USD 110.00 = USD 11,110.00");
    expect(screen.queryByRole("button", { name: "Request via Mercury" })).toBeNull();
  });
  it("승인 무효화·플래그를 배지로 보여 준다", async () => {
    list.mockResolvedValue({ ok: true, data: { rows: [row({ status: "needs_review", approvalInvalidated: true, reasons: ["recipient_changed"] })], gateOpen: false, mercuryEnabled: false } });
    render(<MercuryPayoutsPanel />);
    await waitFor(() => expect(screen.getByText("Approval invalidated — re-approval required")).toBeTruthy());
    expect(screen.getByText("Bank details changed")).toBeTruthy();
  });
  it("빈 목록과 오류를 안내한다", async () => {
    list.mockResolvedValue({ ok: false, error: "You do not have permission for this action." });
    render(<MercuryPayoutsPanel />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("permission"));
    expect(screen.getByTestId("mercury-empty")).toBeTruthy();
  });
});
