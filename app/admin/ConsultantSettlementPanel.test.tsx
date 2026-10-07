import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  listConsultants: vi.fn(), account: vi.fn(), periods: vi.fn(), fee: vi.fn(), perm: vi.fn(),
  create: vi.fn(),
}));
vi.mock("./consultant-settlement-actions", () => ({
  listPayoutConsultantsAction: m.listConsultants,
  getConsultantPayoutAccountAction: m.account,
  getConsultantContractFeeAction: m.fee,
  listConsultantPayoutPeriodsAction: m.periods,
  listConsultantPayoutPeriodEventsAction: vi.fn(),
  createConsultantPayoutPeriodAction: m.create,
  updateConsultantPayoutPeriodAmountAction: vi.fn(),
  updateConsultantPayoutPeriodStatusAction: vi.fn(),
  revealConsultantPayoutAccountAction: vi.fn(),
  saveConsultantPayoutAccountByAdminAction: vi.fn(),
}));
vi.mock("./teacher-payout-accounts-actions", () => ({ getPayoutAccountStaffPermissionAction: m.perm }));

import ConsultantSettlementPanel from "./ConsultantSettlementPanel";

beforeEach(() => {
  vi.clearAllMocks();
  m.listConsultants.mockResolvedValue([{ id: "c1", name: "민", email: "m@x.com", students: [] }]);
  m.account.mockResolvedValue(null);
  m.periods.mockResolvedValue([]);
  m.perm.mockResolvedValue({ canManage: false });
  m.create.mockResolvedValue(undefined);
});

async function open() {
  render(<ConsultantSettlementPanel />);
  fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
}

describe("컨설턴트 정산 — 계약 기준 금액 제안(1단계)", () => {
  it("서명된 계약이 없으면 제안 영역이 없다", async () => {
    m.fee.mockResolvedValue(null);
    await open();
    await waitFor(() => expect(m.fee).toHaveBeenCalledWith("c1"));
    expect(screen.queryByTestId("contract-suggestion")).not.toBeInTheDocument();
  });

  it("기간을 넣으면 제안 금액을 보여주되 입력칸을 자동으로 채우지 않는다", async () => {
    m.fee.mockResolvedValue({ agreementId: "agr-1", endDate: null, monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: "2026-10-01T00:00:00Z" });
    const { container } = render(<ConsultantSettlementPanel />);
    fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
    const [start, end] = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(start, { target: { value: "2026-10-01" } });
    fireEvent.change(end, { target: { value: "2026-10-15" } });
    expect(await screen.findByTestId("suggested-amount")).toHaveTextContent("1,500,000 KRW");
    expect((screen.getByPlaceholderText("금액") as HTMLInputElement).value).toBe("");
  });

  it("수기 금액이 다르거나 통화가 다르면 경고하되 등록은 막지 않는다", async () => {
    m.fee.mockResolvedValue({ agreementId: "agr-1", endDate: null, monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: null });
    const { container } = render(<ConsultantSettlementPanel />);
    fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
    const [start, end] = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(start, { target: { value: "2026-10-01" } });
    fireEvent.change(end, { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByPlaceholderText("금액"), { target: { value: "1000000" } });
    expect(await screen.findByTestId("suggestion-warning")).toHaveTextContent("금액이");
    fireEvent.change(screen.getByLabelText("통화"), { target: { value: "USD" } });
    expect(screen.getByTestId("suggestion-warning")).toHaveTextContent("통화");
    // 경고가 있어도 등록 버튼은 눌린다.
    fireEvent.click(screen.getByText("기간 등록"));
    await waitFor(() => expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", amountMinor: 100000000 })));
  });

  it("표준 기간이 아니면 제안 대신 사유를 보여준다", async () => {
    m.fee.mockResolvedValue({ agreementId: "agr-1", endDate: null, monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: null });
    const { container } = render(<ConsultantSettlementPanel />);
    fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
    const [start, end] = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(start, { target: { value: "2026-10-05" } });
    fireEvent.change(end, { target: { value: "2026-10-20" } });
    expect(await screen.findByTestId("contract-suggestion")).toHaveTextContent("표준 반월 기간");
    expect(screen.queryByTestId("suggested-amount")).not.toBeInTheDocument();
  });

  async function openWithPeriod(start: string, end: string) {
    m.fee.mockResolvedValue({ agreementId: "agr-1", endDate: null, monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: null });
    const { container } = render(<ConsultantSettlementPanel />);
    fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
    const [s, e] = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(s, { target: { value: start } });
    fireEvent.change(e, { target: { value: end } });
  }

  it("'계약 기준으로 채우기': 확인창에서 근거를 보여주고, 동의해야만 금액·통화·메모를 채운다(수정 가능)", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await openWithPeriod("2026-10-01", "2026-10-15");
    fireEvent.click(await screen.findByTestId("fill-from-contract"));
    expect(confirmSpy.mock.calls[0][0]).toContain("1,500,000 KRW");
    expect(confirmSpy.mock.calls[0][0]).toContain("agr-1");
    expect((screen.getByPlaceholderText("금액") as HTMLInputElement).value).toBe("1500000");
    expect((screen.getByPlaceholderText("메모(선택)") as HTMLInputElement).value).toBe("from contract agr-1, 2026-10 1~15일분(월 보수 × 15/31)");
    // 수기 수정 가능 + 경고(제안과 다름)는 계속 표시, 등록은 막지 않는다.
    fireEvent.change(screen.getByPlaceholderText("금액"), { target: { value: "1400000" } });
    expect(screen.getByTestId("suggestion-warning")).toHaveTextContent("금액이");
    fireEvent.click(screen.getByText("기간 등록"));
    await waitFor(() => expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 140000000, note: expect.stringContaining("from contract agr-1") })));
    confirmSpy.mockRestore();
  });

  it("확인창에서 취소하면 아무것도 채우지 않는다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await openWithPeriod("2026-10-01", "2026-10-15");
    fireEvent.click(await screen.findByTestId("fill-from-contract"));
    expect((screen.getByPlaceholderText("금액") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("메모(선택)") as HTMLInputElement).value).toBe("");
    confirmSpy.mockRestore();
  });

  it("표준 기간이 아니면 채우기 버튼이 없다", async () => {
    await openWithPeriod("2026-10-05", "2026-10-20");
    await screen.findByTestId("contract-suggestion");
    expect(screen.queryByTestId("fill-from-contract")).not.toBeInTheDocument();
  });

  it("같은 기간과 겹치는 정산이 이미 있으면 이중 계상 경고(차단 아님)", async () => {
    m.periods.mockResolvedValue([{ id: "p1", periodStart: "2026-10-01", periodEnd: "2026-10-15", amountMinor: 1, currency: "KRW", status: "draft", note: null, createdAt: "2026-10-16T00:00:00Z", confirmedAt: null, paidAt: null }]);
    await openWithPeriod("2026-10-01", "2026-10-15");
    expect(await screen.findByTestId("overlap-warning")).toHaveTextContent("이중 지급");
  });
});
