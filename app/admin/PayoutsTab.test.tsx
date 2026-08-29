import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayoutsTab from "./PayoutsTab";
import type { PayoutListItem } from "./payouts-data";
import {
  generatePayouts,
  markPayoutPaid,
  markPayoutsPaidBulk,
  revertPayoutToPending,
} from "./payouts-actions";

vi.mock("./payouts-actions", () => ({
  generatePayouts: vi.fn(),
  markPayoutPaid: vi.fn(),
  markPayoutsPaidBulk: vi.fn(),
  revertPayoutToPending: vi.fn(),
}));

const payouts: PayoutListItem[] = [
  {
    id: "p1",
    teacherId: "t1",
    teacherName: "박서연",
    amountKrw: 750000,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "pending",
    paidAt: null,
  },
  {
    id: "p2",
    teacherId: "t2",
    teacherName: "이도현",
    amountKrw: 450000,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "paid",
    paidAt: "2026-09-03T00:00:00.000Z",
  },
];

describe("PayoutsTab", () => {
  it("정산 목록을 상태와 함께 보여준다", () => {
    render(<PayoutsTab initialPayouts={payouts} />);
    expect(screen.getByText("박서연")).toBeInTheDocument();
    expect(screen.getByText("750,000원")).toBeInTheDocument();
    expect(screen.getByText("이도현")).toBeInTheDocument();
  });

  it("대기 중인 항목의 승인 버튼을 누르면 markPayoutPaid가 호출된다", async () => {
    vi.mocked(markPayoutPaid).mockResolvedValue(undefined);
    render(<PayoutsTab initialPayouts={payouts} />);

    fireEvent.click(screen.getByText("승인"));

    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledWith("p1"));
  });

  it("완료된 항목엔 완료 취소 버튼이 보이고 누르면 revertPayoutToPending이 호출된다", async () => {
    vi.mocked(revertPayoutToPending).mockResolvedValue(undefined);
    render(<PayoutsTab initialPayouts={payouts} />);

    fireEvent.click(screen.getByText("완료 취소"));

    await waitFor(() => expect(revertPayoutToPending).toHaveBeenCalledWith("p2"));
  });

  it("전체 승인을 누르면 대기 중인 모든 id로 markPayoutsPaidBulk가 호출된다", async () => {
    vi.mocked(markPayoutsPaidBulk).mockResolvedValue(undefined);
    render(<PayoutsTab initialPayouts={payouts} />);

    fireEvent.click(screen.getByText("전체 승인"));

    await waitFor(() => expect(markPayoutsPaidBulk).toHaveBeenCalledWith(["p1"]));
  });

  it("정산 생성 버튼을 누르면 generatePayouts가 기본 기간(전월)으로 호출된다", async () => {
    vi.mocked(generatePayouts).mockResolvedValue({ created: 2, skippedNoRate: [] });
    render(<PayoutsTab initialPayouts={[]} />);

    fireEvent.click(screen.getByText("정산 생성"));

    await waitFor(() => expect(generatePayouts).toHaveBeenCalled());
  });
});
