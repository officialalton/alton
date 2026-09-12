import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PayoutBatchesTab from "./PayoutBatchesTab";
import type { PayoutBatchListItem } from "./payout-batches-data";

// P4-2(UAT 후속) — 탭이 마운트되면 목록을 직접 조회한다(SSR initialBatches만
// 믿다가 "탭을 다시 열면 목록이 비어 보이는" 버그가 있었다). 기본 목은 SSR로
// 받은 값과 같은 배열을 돌려주도록 beforeEach에서 채운다.
const { listMock, deleteMock, closeMonthMock, autoDispatchMock, gateMock, ensureDateMock, externalMock } =
  vi.hoisted(() => ({
  listMock: vi.fn(),
  deleteMock: vi.fn(),
  closeMonthMock: vi.fn(),
  autoDispatchMock: vi.fn(),
  gateMock: vi.fn(),
  ensureDateMock: vi.fn(),
  externalMock: vi.fn(),
}));

vi.mock("./payout-batches-actions", () => ({
  generatePayoutBatches: vi.fn(),
  submitPayoutBatchForReview: vi.fn(),
  approvePayoutBatch: vi.fn(),
  markPayoutBatchFailed: vi.fn(),
  adjustPayoutBatchAmount: vi.fn(),
  listPayoutBatchesAction: listMock,
  deletePayoutBatch: deleteMock,
  closePayoutMonthNow: closeMonthMock,
  getAutoDispatchEnabled: autoDispatchMock,
  getDisbursementGateEnabled: gateMock,
  ensurePayoutBatchScheduledDate: ensureDateMock,
  setAutoDispatchEnabled: vi.fn(),
  setPayoutBatchScheduledDate: vi.fn(),
  setPayoutBatchAutoDispatch: vi.fn(),
  dispatchPayoutBatchNow: vi.fn(),
  recordExternalPayoutTransfer: externalMock,
}));

const batches: PayoutBatchListItem[] = [
  {
    id: "b1",
    teacherId: "t1",
    teacherName: "박서연",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    currency: "KRW",
    status: "reviewing",
    totalAmountMinor: 75000,
    itemCount: 2,
    createdAt: "2026-09-01T00:00:00Z",
    approvedAt: null,
    paidAt: null,
    failureReason: null,
    scheduledPayoutDate: null,
    autoDispatchEnabled: true,
    externalTransferRecordedAt: null,
    items: [],
    auditLog: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  deleteMock.mockResolvedValue({ status: "deleted" });
  closeMonthMock.mockResolvedValue({ closed: 1, itemCount: 2 });
  autoDispatchMock.mockResolvedValue(true);
  // 기본은 지급 경계가 닫힌 상태(현재 운영 상태와 같다).
  gateMock.mockResolvedValue(false);
  ensureDateMock.mockResolvedValue({ status: "ok" });
  externalMock.mockResolvedValue({ status: "ok" });
});

describe("PayoutBatchesTab (v3, R10 Task C)", () => {
  it("batch 목록과 승인 버튼을 렌더링하고, 지급 실행 버튼은 노출하지 않는다", () => {
    listMock.mockResolvedValue(batches);
    render(<PayoutBatchesTab initialBatches={batches} />);

    expect(screen.getByText("박서연")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
    expect(screen.queryByText("지급 처리")).not.toBeInTheDocument();
    expect(screen.queryByText("지급 완료 처리")).not.toBeInTheDocument();
  });

  it("batch가 없으면 안내 문구를 보여준다", () => {
    listMock.mockResolvedValue([]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    expect(screen.getByText("정산 batch가 없습니다.")).toBeInTheDocument();
  });
});

// R10 corrective(요구사항 4, 2026-09-07 리뷰): "실패 처리" 버튼은
// mark_payout_batch_failed()가 실제로 허용하는 상태에서만 나타나야 한다
// (supabase/migrations/20261224000000_r10_paid_transition_guard_and_reversal_fix.sql).
// 상세를 펼쳐야 버튼이 보이므로 각 케이스에서 "상세"를 먼저 클릭한다.
function makeBatch(status: PayoutBatchListItem["status"]): PayoutBatchListItem {
  return {
    id: `b-${status}`,
    teacherId: "t1",
    teacherName: "박서연",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    currency: "KRW",
    status,
    totalAmountMinor: 75000,
    itemCount: 2,
    createdAt: "2026-09-01T00:00:00Z",
    approvedAt: null,
    paidAt: null,
    failureReason: status === "failed" ? "테스트 사유" : null,
    scheduledPayoutDate: status === "approved" ? "2026-10-10" : null,
    autoDispatchEnabled: true,
    externalTransferRecordedAt: null,
    items: [],
    auditLog: [],
  };
}

// 2026-09-12(UAT 후속) — "지급 실패 기록"은 실제 Wise 송금 요청 이후 단계에서만
// 의미가 있다. 그 전 단계(초안/검토/승인)에는 숨긴다.
describe("PayoutBatchesTab — 지급 실패 기록은 송금 요청 이후에만 보인다", () => {
  it.each([
    ["draft", false],
    ["calculated", false],
    ["reviewing", false],
    ["reviewed", false],
    ["approved", false],
    ["dispatch_requested", true],
    ["provider_pending", true],
    ["paid", false],
    ["failed", true],
  ] as const)("status=%s일 때 실패 처리 버튼 노출 여부 = %s", (status, expected) => {
    listMock.mockResolvedValue([makeBatch(status)]);
  render(<PayoutBatchesTab initialBatches={[makeBatch(status)]} />);
    fireEvent.click(screen.getByText("상세"));
    const button = screen.queryByRole("button", { name: "실패 처리" });
    if (expected) {
      expect(button).toBeInTheDocument();
    } else {
      expect(button).not.toBeInTheDocument();
    }
  });
});

describe("PayoutBatchesTab — UAT 후속(2026-09-12)", () => {
  it("SSR이 빈 배열을 줘도 마운트 시 목록을 직접 조회해 채운다(탭 재진입 시 목록이 사라지던 버그)", async () => {
    listMock.mockResolvedValue(batches);
    render(<PayoutBatchesTab initialBatches={[]} />);

    expect(await screen.findByText("박서연")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("월 마감 실행 버튼이 자동 마감과 같은 경로를 호출한다", async () => {
    listMock.mockResolvedValue(batches);
    render(<PayoutBatchesTab initialBatches={batches} />);

    fireEvent.click(await screen.findByTestId("close-month-now"));
    await waitFor(() => expect(closeMonthMock).toHaveBeenCalledTimes(1));
  });

  it("승인 전 묶음에는 삭제 버튼이 보이고, 승인된 묶음에는 보이지 않는다", async () => {
    listMock.mockResolvedValue([makeBatch("reviewed")]);
    const { unmount } = render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    expect(screen.getByTestId("delete-batch-b-reviewed")).toBeInTheDocument();
    unmount();

    listMock.mockResolvedValue([makeBatch("approved")]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    expect(screen.queryByTestId("delete-batch-b-approved")).not.toBeInTheDocument();
  });

  it("삭제가 거부되면 사유를 보여준다(승인 이후 묶음 등)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    listMock.mockResolvedValue([makeBatch("reviewed")]);
    deleteMock.mockResolvedValue({
      status: "rejected",
      error: "승인 전(검토 단계) 묶음만 삭제할 수 있습니다(현재: approved).",
    });

    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    fireEvent.click(screen.getByTestId("delete-batch-b-reviewed"));

    expect(await screen.findByText(/승인 전\(검토 단계\) 묶음만 삭제할 수 있습니다/)).toBeInTheDocument();
  });
});

describe("PayoutBatchesTab — 승인 묶음 운영 UX (2026-09-12 UAT 후속)", () => {
  function approvedBatch(over: Partial<PayoutBatchListItem> = {}): PayoutBatchListItem {
    return { ...makeBatch("approved"), scheduledPayoutDate: "2026-10-10", ...over };
  }

  it("예정일이 비어 있으면 왜 미정인지와 무엇을 해야 하는지 안내하고 확정 버튼을 준다", async () => {
    listMock.mockResolvedValue([approvedBatch({ scheduledPayoutDate: null })]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));

    const notice = screen.getByTestId("sched-missing-b-approved");
    expect(notice).toHaveTextContent("예정일이 없으면 자동 송금 대상에서 빠집니다");
    fireEvent.click(screen.getByTestId("ensure-date-b-approved"));
    await waitFor(() => expect(ensureDateMock).toHaveBeenCalledWith("b-approved"));
  });

  it("예정일이 있으면 미정 안내를 띄우지 않는다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    expect(screen.queryByTestId("sched-missing-b-approved")).not.toBeInTheDocument();
    expect(screen.getByTestId("sched-b-approved")).toHaveTextContent("2026-10-10");
  });

  it("Wise 연동 게이트가 닫혀 있으면 '지금 송금 요청'을 실행 버튼으로 두지 않는다", async () => {
    gateMock.mockResolvedValue(false);
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));

    await waitFor(() =>
      expect(screen.getByTestId("dispatch-disabled-b-approved")).toHaveTextContent(
        "Wise 연동 전에는 사용할 수 없습니다"
      )
    );
    expect(screen.queryByTestId("dispatch-now-b-approved")).not.toBeInTheDocument();
  });

  it("게이트가 열리면 실행 버튼으로 바뀐다", async () => {
    gateMock.mockResolvedValue(true);
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    await waitFor(() => expect(screen.getByTestId("dispatch-now-b-approved")).toBeInTheDocument());
  });

  it("승인 묶음의 작업 영역은 기본으로 펼쳐지지 않는다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));

    expect(screen.queryByTestId("external-date-b-approved-error")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("송금 완료일")).not.toBeInTheDocument();
    expect(screen.queryByTestId("date-input-b-approved")).not.toBeInTheDocument();
  });

  it("외부 송금 기록: 완료일이 비면 그 입력칸 아래에 오류를 보여주고 서버를 부르지 않는다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    fireEvent.click(screen.getByTestId("open-external-b-approved"));
    fireEvent.click(screen.getByTestId("record-external-b-approved"));

    expect(await screen.findByTestId("external-date-b-approved-error")).toHaveTextContent(
      "송금 완료일을 입력해주세요."
    );
    expect(externalMock).not.toHaveBeenCalled();
  });

  // 2026-09-12 정정: 거래번호는 송금 실행에 필요한 값이 아니라 사후 대사 보조
  // 정보다. 값이 없다는 이유로 이미 보낸 돈을 기록하지 못하면 안 된다.
  it("외부 송금 기록: 확인 메모는 선택이라 비어 있어도 기록된다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    fireEvent.click(screen.getByTestId("open-external-b-approved"));

    fireEvent.change(screen.getByLabelText("송금 완료일"), { target: { value: "2026-10-10" } });
    fireEvent.click(screen.getByTestId("record-external-b-approved"));

    await waitFor(() =>
      expect(externalMock).toHaveBeenCalledWith(
        expect.objectContaining({ transferredOn: "2026-10-10", amountMinor: 75000, bankReference: undefined })
      )
    );
    expect(screen.queryByTestId("external-ref-b-approved-error")).not.toBeInTheDocument();
  });

  it("외부 송금 기록: 확인 메모 입력칸에 필수 표시가 없다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    fireEvent.click(screen.getByTestId("open-external-b-approved"));

    expect(screen.getByText("송금 확인 메모(선택)")).toBeInTheDocument();
    expect(screen.queryByText("은행 거래번호 또는 이체확인증 번호")).not.toBeInTheDocument();
  });

  it("외부 송금 기록: 금액은 읽기 전용이고 승인된 최종 송금액을 그대로 보낸다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    fireEvent.click(screen.getByTestId("open-external-b-approved"));

    const amount = screen.getByLabelText("최종 승인 금액") as HTMLInputElement;
    expect(amount.readOnly).toBe(true);
    expect(screen.getByText(/금액을 바꾸려면 먼저/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("송금 완료일"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("송금 확인 메모"), { target: { value: "2026091200123456" } });
    fireEvent.click(screen.getByTestId("record-external-b-approved"));

    await waitFor(() =>
      expect(externalMock).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: "b-approved",
          transferredOn: "2026-10-10",
          amountMinor: 75000,
          currency: "KRW",
          bankReference: "2026091200123456",
        })
      )
    );
  });

  it("외부 송금 기록: 실제 은행 송금 뒤에만 쓰는 기능임을 명시한다", async () => {
    listMock.mockResolvedValue([approvedBatch()]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));
    fireEvent.click(screen.getByTestId("open-external-b-approved"));
    expect(screen.getByText(/실제 은행에서 송금을 마친 뒤에만/)).toBeInTheDocument();
  });

  it("항목과 감사 로그를 한국어로 보여주고 조정 사유를 함께 표시한다", async () => {
    listMock.mockResolvedValue([
      approvedBatch({
        items: [
          { id: "i1", itemType: "trial", amountMinor: 50000, currency: "KRW", payableMinutes: 60, status: "approved", adjustmentReason: null },
          { id: "i2", itemType: "adjustment", amountMinor: -5000, currency: "KRW", payableMinutes: 0, status: "approved", adjustmentReason: "교통비 차감" },
        ],
        auditLog: [
          { id: "a1", action: "approved", actorName: "김관리", note: null, createdAt: "2026-09-12T00:00:00Z" },
          { id: "a2", action: "auto_closed", actorName: null, note: null, createdAt: "2026-09-12T00:00:00Z" },
        ],
      }),
    ]);
    render(<PayoutBatchesTab initialBatches={[]} />);
    fireEvent.click(await screen.findByText("상세"));

    expect(screen.getByText(/체험 수업 · 60분/)).toBeInTheDocument();
    expect(screen.getByText(/관리자 조정 · 교통비 차감/)).toBeInTheDocument();
    expect(screen.getByText(/송금 승인 · 김관리/)).toBeInTheDocument();
    expect(screen.getByText(/월 마감\(자동\) · 시스템\(자동\)/)).toBeInTheDocument();
    expect(screen.queryByText(/알 수 없음/)).not.toBeInTheDocument();
  });
});
