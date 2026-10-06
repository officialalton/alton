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
    m.fee.mockResolvedValue({ monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: "2026-10-01T00:00:00Z" });
    const { container } = render(<ConsultantSettlementPanel />);
    fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
    const [start, end] = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(start, { target: { value: "2026-10-01" } });
    fireEvent.change(end, { target: { value: "2026-10-15" } });
    expect(await screen.findByTestId("suggested-amount")).toHaveTextContent("1,500,000 KRW");
    expect((screen.getByPlaceholderText("금액") as HTMLInputElement).value).toBe("");
  });

  it("수기 금액이 다르거나 통화가 다르면 경고하되 등록은 막지 않는다", async () => {
    m.fee.mockResolvedValue({ monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: null });
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
    m.fee.mockResolvedValue({ monthlyFeeMinor: 3100000, currency: "KRW", startDate: null, signedAt: null });
    const { container } = render(<ConsultantSettlementPanel />);
    fireEvent.change(await screen.findByRole("combobox", { name: "" }), { target: { value: "c1" } });
    const [start, end] = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(start, { target: { value: "2026-10-05" } });
    fireEvent.change(end, { target: { value: "2026-10-20" } });
    expect(await screen.findByTestId("contract-suggestion")).toHaveTextContent("표준 반월 기간");
    expect(screen.queryByTestId("suggested-amount")).not.toBeInTheDocument();
  });
});
