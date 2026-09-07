import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PayoutBatchesTab from "./PayoutBatchesTab";
import type { PayoutBatchListItem } from "./payout-batches-data";

vi.mock("./payout-batches-actions", () => ({
  generatePayoutBatches: vi.fn(),
  submitPayoutBatchForReview: vi.fn(),
  approvePayoutBatch: vi.fn(),
  markPayoutBatchFailed: vi.fn(),
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

describe("PayoutBatchesTab (v3, R10 Task C)", () => {
  it("batch 목록과 승인 버튼을 렌더링하고, 지급 실행 버튼은 노출하지 않는다", () => {
    render(<PayoutBatchesTab initialBatches={batches} />);

    expect(screen.getByText("박서연")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
    expect(screen.queryByText("지급 처리")).not.toBeInTheDocument();
    expect(screen.queryByText("지급 완료 처리")).not.toBeInTheDocument();
  });

  it("batch가 없으면 안내 문구를 보여준다", () => {
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
