import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaymentRefundBoard from "./PaymentRefundBoard";

const listMock = vi.fn();
const resolveRefundMock = vi.fn();
const resolveIssueMock = vi.fn();
vi.mock("./payment-refund-actions", () => ({
  listPaymentRefundBoard: (...a: unknown[]) => listMock(...a),
  resolvePaymentRefund: (...a: unknown[]) => resolveRefundMock(...a),
  resolvePaymentWebhookIssue: (...a: unknown[]) => resolveIssueMock(...a),
}));

const refund = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  purchaseId: "p1",
  stripeRefundId: "re_1",
  amountMinor: 21875,
  currency: "USD",
  status: "succeeded",
  needsReview: true,
  autoRevokeStatus: null,
  handledBy: null,
  handledAt: null,
  handledAction: null,
  handledNote: null,
  createdAt: "2026-10-20T00:00:00Z",
  purchase: { totalMinor: 21875, currency: "USD", status: "succeeded" },
  entitlement: { granted: 20, balance: 19, consumed: 0, activeHolds: 1, refunded: 0 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  resolveRefundMock.mockResolvedValue(undefined);
  resolveIssueMock.mockResolvedValue(undefined);
});

describe("PaymentRefundBoard", () => {
  it("환불 내역·수업권 현황·자동 회수 꺼짐 상태를 보여준다", async () => {
    listMock.mockResolvedValue({ refunds: [refund()], issues: [] });
    render(<PaymentRefundBoard />);
    expect(await screen.findByText(/자동 회수 꺼짐/)).toBeTruthy();
    expect(screen.getByText(/지급 20 · 잔여 19 · 소비 0 · 예약 점유 1/)).toBeTruthy();
    expect(screen.getByText(/구매 ID: p1/)).toBeTruthy();
  });

  it("자동 회수 불가 사유를 수동 처리 사유로 표시한다", async () => {
    listMock.mockResolvedValue({ refunds: [refund({ autoRevokeStatus: "partially_used_or_reserved" })], issues: [] });
    render(<PaymentRefundBoard />);
    expect(await screen.findByText(/수업권 일부 사용·예약 이력/)).toBeTruthy();
  });

  it("사유 없이는 처리 버튼이 비활성이고, 사유 입력 후 회수 액션을 호출한 뒤 목록을 새로 읽는다", async () => {
    listMock.mockResolvedValue({ refunds: [refund()], issues: [] });
    render(<PaymentRefundBoard />);
    const revokeBtn = (await screen.findByText("수업권 회수")) as HTMLButtonElement;
    expect(revokeBtn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("처리 사유"), { target: { value: "오너 확인" } });
    expect(revokeBtn.disabled).toBe(false);
    fireEvent.click(revokeBtn);
    await waitFor(() =>
      expect(resolveRefundMock).toHaveBeenCalledWith({ refundId: "r1", action: "revoke", note: "오너 확인" })
    );
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("Stripe 환불이 성공 상태가 아니면 회수 버튼이 막힌다(pending/failed)", async () => {
    listMock.mockResolvedValue({ refunds: [refund({ status: "pending" })], issues: [] });
    render(<PaymentRefundBoard />);
    const btn = (await screen.findByText("수업권 회수")) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("처리 사유"), { target: { value: "x" } });
    expect(btn.disabled).toBe(true);
  });

  it("구매 미연결 환불은 회수할 수 없고 확인 완료만 가능하다", async () => {
    listMock.mockResolvedValue({ refunds: [refund({ purchaseId: null, purchase: null, entitlement: null })], issues: [] });
    render(<PaymentRefundBoard />);
    const btn = (await screen.findByText("수업권 회수")) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("처리 사유"), { target: { value: "x" } });
    expect(btn.disabled).toBe(true);
    expect((screen.getByText("확인 완료") as HTMLButtonElement).disabled).toBe(false);
  });

  it("서버 오류(이미 처리됨 등)는 알림으로 표시한다", async () => {
    listMock.mockResolvedValue({ refunds: [refund()], issues: [] });
    resolveRefundMock.mockRejectedValueOnce(new Error("이미 처리된 환불 기록입니다."));
    render(<PaymentRefundBoard />);
    fireEvent.change(await screen.findByLabelText("처리 사유"), { target: { value: "x" } });
    fireEvent.click(screen.getByText("확인 완료"));
    expect((await screen.findByRole("alert")).textContent).toContain("이미 처리된 환불 기록입니다.");
  });

  it("처리 완료 기록에는 처리자·시각·사유가 남는다", async () => {
    listMock.mockResolvedValue({
      refunds: [refund({ handledAt: "2026-10-21T00:00:00Z", handledBy: "admin1", handledAction: "revoke", handledNote: "확인함", needsReview: false })],
      issues: [],
    });
    render(<PaymentRefundBoard />);
    expect(await screen.findByText(/처리 완료 1건/)).toBeTruthy();
    expect(screen.getByText(/처리자 admin1/)).toBeTruthy();
    expect(screen.getByText(/사유: 확인함/)).toBeTruthy();
    expect(screen.queryByTestId("refund-pending")).toBeNull();
  });

  it("웹훅 이상(모드·금액 불일치)을 표시하고 사유를 남겨 해결 처리한다", async () => {
    listMock.mockResolvedValue({
      refunds: [],
      issues: [
        { id: "i1", eventId: "evt_1", kind: "livemode_mismatch", purchaseId: null, detail: {}, createdAt: "2026-10-20T00:00:00Z", resolvedAt: null, resolvedNote: null },
        { id: "i2", eventId: "evt_2", kind: "amount_mismatch", purchaseId: "p9", detail: {}, createdAt: "2026-10-20T00:00:00Z", resolvedAt: null, resolvedNote: null },
      ],
    });
    render(<PaymentRefundBoard />);
    expect(await screen.findByText("테스트/라이브 모드 불일치")).toBeTruthy();
    expect(screen.getByText("결제 금액·통화 불일치")).toBeTruthy();
    const inputs = screen.getAllByLabelText("확인 사유");
    fireEvent.change(inputs[0], { target: { value: "설정 수정 후 재전송" } });
    fireEvent.click(screen.getAllByText("해결 처리")[0]);
    await waitFor(() => expect(resolveIssueMock).toHaveBeenCalledWith({ issueId: "i1", note: "설정 수정 후 재전송" }));
  });

  it("건수('N건 중 M건 표시')를 보이고 필터로 확인 필요 건만 좁힌다", async () => {
    listMock.mockResolvedValue({
      refunds: [refund({ id: "old", purchaseId: "pOld", needsReview: true }), refund({ id: "x", purchaseId: "pX", needsReview: false })],
      issues: [],
      counts: { refundsTotal: 250, refundsPending: 2, refundsShown: 102, issuesTotal: 3, issuesOpen: 1, issuesShown: 3 },
    });
    render(<PaymentRefundBoard />);
    expect(await screen.findByText(/환불 기록 250건 중 102건 표시 · 처리 대기 2건/)).toBeTruthy();
    expect(screen.getAllByTestId("refund-pending")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("환불 필터"), { target: { value: "review" } });
    expect(screen.getAllByTestId("refund-pending")).toHaveLength(1);
    expect(screen.getByTestId("issue-counts").textContent).toMatch(/3건 중 3건 표시 · 미해결 1건/);
  });
});
