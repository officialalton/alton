import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
