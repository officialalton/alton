import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PayoutBatchesTab from "./PayoutBatchesTab";
import type { PayoutBatchListItem } from "./payout-batches-data";

// P4-2(UAT 후속) — 탭이 마운트되면 목록을 직접 조회한다(SSR initialBatches만
// 믿다가 "탭을 다시 열면 목록이 비어 보이는" 버그가 있었다). 기본 목은 SSR로
// 받은 값과 같은 배열을 돌려주도록 beforeEach에서 채운다.
const { listMock, deleteMock, closeMonthMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  deleteMock: vi.fn(),
  closeMonthMock: vi.fn(),
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
    items: [],
    auditLog: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  deleteMock.mockResolvedValue({ status: "deleted" });
  closeMonthMock.mockResolvedValue({ closed: 1, itemCount: 2 });
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
    items: [],
    auditLog: [],
  };
}

describe("PayoutBatchesTab — 실패 처리 버튼과 DB 허용 상태 일치 (R10 corrective 요구사항 4)", () => {
  it.each([
    ["draft", true],
    ["calculated", true],
    ["reviewing", true],
    ["reviewed", true],
    ["approved", true],
    ["paid", false],
    ["failed", false],
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
