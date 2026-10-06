import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ getAccount: vi.fn(), save: vi.fn(), periods: vi.fn(), notices: vi.fn(), markRead: vi.fn() }));
vi.mock("./settlement-actions", () => ({
  getMyPayoutAccountAction: m.getAccount,
  saveMyPayoutAccountAction: m.save,
  listMyPayoutPeriodsAction: m.periods,
  listMyPayoutNoticesAction: m.notices,
  markMyPayoutNoticeReadAction: m.markRead,
}));

import SettlementPanel from "./SettlementPanel";

const SAVED = { accountHolderName: "지만", bankName: "국민은행", accountNumberMasked: "****6789", currency: "KRW", country: "KR", swiftOrRouting: null, updatedAt: "2026-10-06T00:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  m.getAccount.mockResolvedValue(null);
  m.periods.mockResolvedValue([]);
  m.notices.mockResolvedValue([]);
});

describe("컨설턴트 Settlement — 수취 계좌", () => {
  it("계좌가 없으면 필수 등록 폼을 보여주고, 저장하면 읽기 전용 마스킹 화면으로 바뀐다", async () => {
    m.save.mockResolvedValue({ status: "saved", account: SAVED });
    const onSaved = vi.fn();
    render(<SettlementPanel onAccountSaved={onSaved} />);
    expect(await screen.findByTestId("account-setup")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Account holder"), { target: { value: "지만" } });
    fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "국민은행" } });
    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "110-123-456789" } });
    fireEvent.click(screen.getByTestId("account-save"));
    expect(await screen.findByTestId("account-masked")).toHaveTextContent("****6789");
    expect(screen.queryByText(/110-123-456789/)).not.toBeInTheDocument();
    expect(screen.getByTestId("account-locked-note")).toHaveTextContent("To change your account details, contact ALTON staff.");
    expect(screen.queryByTestId("account-save")).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it("이미 등록돼 있으면 처음부터 읽기 전용이고 수정 수단이 없다", async () => {
    m.getAccount.mockResolvedValue(SAVED);
    render(<SettlementPanel />);
    expect(await screen.findByTestId("account-readonly")).toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("account-setup")).not.toBeInTheDocument();
  });

  it("서버가 거부하면 사유를 보여주고 폼을 유지한다", async () => {
    m.save.mockResolvedValue({ status: "invalid", message: "A U.S. account needs a 9-digit ABA routing number." });
    render(<SettlementPanel />);
    fireEvent.click(await screen.findByTestId("account-save"));
    expect(await screen.findByText(/9-digit ABA routing number/)).toBeInTheDocument();
    expect(screen.getByTestId("account-setup")).toBeInTheDocument();
  });

  it("알림: 최근 알림과 읽지 않음 표시, 읽음 처리, 없으면 숨김", async () => {
    m.getAccount.mockResolvedValue(SAVED);
    m.markRead.mockResolvedValue({ ok: true });
    m.notices.mockResolvedValue([
      { id: "n1", kind: "payout_account_updated", message: "Your payout account details were updated by ALTON staff. If this was not expected, contact us.", createdAt: "2026-10-06T00:00:00Z", read: false },
    ]);
    render(<SettlementPanel />);
    expect(await screen.findByTestId("payout-notice-n1")).toHaveTextContent("updated by ALTON staff");
    fireEvent.click(screen.getByTestId("mark-read-n1"));
    await waitFor(() => expect(m.markRead).toHaveBeenCalledWith("n1"));
    await waitFor(() => expect(screen.queryByTestId("mark-read-n1")).not.toBeInTheDocument());
  });

  it("알림이 없으면 카드가 보이지 않는다", async () => {
    m.getAccount.mockResolvedValue(SAVED);
    render(<SettlementPanel />);
    await screen.findByTestId("account-readonly");
    expect(screen.queryByTestId("payout-notices")).not.toBeInTheDocument();
  });
});

describe("컨설턴트 Settlement — 기한 경과 표기", () => {
  it("확정(미지급)인데 기한이 지난 기간은 'Was due … — processing'과 Overdue 배지로 보인다", async () => {
    m.getAccount.mockResolvedValue(SAVED);
    m.periods.mockResolvedValue([
      { id: "p-old", periodStart: "2020-01-01", periodEnd: "2020-01-15", amountMinor: 100000, currency: "KRW", status: "confirmed", note: null, confirmedAt: null, paidAt: null },
      { id: "p-paid", periodStart: "2020-02-01", periodEnd: "2020-02-15", amountMinor: 100000, currency: "KRW", status: "paid", note: null, confirmedAt: null, paidAt: null },
    ]);
    render(<SettlementPanel />);
    expect(await screen.findByText(/Was due Jan 24, 2020 — processing/)).toBeInTheDocument();
    expect(screen.getByText("Overdue — processing")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText("Upcoming payout")).not.toBeInTheDocument();
  });
});
