import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { listOpenHomepageConsultSlotsMock } = vi.hoisted(() => ({
  listOpenHomepageConsultSlotsMock: vi.fn(),
}));
vi.mock("@/app/consult-actions", () => ({
  listOpenHomepageConsultSlots: listOpenHomepageConsultSlotsMock,
}));

import ConsultAvailabilityMonthView from "./ConsultAvailabilityMonthView";

const noopProps = {
  rules: [],
  exceptions: [],
  busyId: null,
  onAddFullDayException: vi.fn(),
  onAddPartialException: vi.fn(),
  onRemoveException: vi.fn(),
};

// 그리드에 이전/다음 달 오버플로우 셀도 같은 날짜 숫자로 렌더링되므로
// (예: "15일" aria-label이 두 번 나올 수 있음), 현재 달 셀(text-grey-200
// 클래스가 없는 쪽)만 골라 클릭 대상으로 쓴다.
function currentMonthDayButton(label: string): HTMLElement {
  const candidates = screen.getAllByLabelText(label);
  const match = candidates.find((el) => !el.className.includes("text-grey-200"));
  if (!match) throw new Error(`현재 달의 "${label}" 셀을 찾지 못했습니다.`);
  return match;
}

describe("ConsultAvailabilityMonthView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("월 슬롯을 조회해 날짜별 배지로 보여주고, 날짜 클릭 시 그날의 시간 목록을 보여준다", async () => {
    listOpenHomepageConsultSlotsMock.mockResolvedValue([
      { startsAt: "2026-10-15T01:00:00.000Z" },
      { startsAt: "2026-10-15T02:00:00.000Z" },
      { startsAt: "2026-10-16T01:00:00.000Z" },
    ]);

    render(<ConsultAvailabilityMonthView timezone="UTC" initialYearMonth="2026-10" {...noopProps} />);

    await waitFor(() => expect(listOpenHomepageConsultSlotsMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("불러오는 중...")).not.toBeInTheDocument());

    fireEvent.click(currentMonthDayButton("15일"));

    await waitFor(() => expect(screen.getByText("오전 01:00")).toBeInTheDocument());
    expect(screen.getByText("오전 02:00")).toBeInTheDocument();
  });

  it("슬롯이 없는 날짜를 클릭하면 빈 상태 메시지를 보여준다", async () => {
    listOpenHomepageConsultSlotsMock.mockResolvedValue([]);
    render(<ConsultAvailabilityMonthView timezone="UTC" initialYearMonth="2026-10" {...noopProps} />);
    await waitFor(() => expect(listOpenHomepageConsultSlotsMock).toHaveBeenCalled());

    fireEvent.click(currentMonthDayButton("10일"));

    await waitFor(() => expect(screen.getByText(/열린 슬롯이 없습니다/)).toBeInTheDocument());
  });

  it("조회 실패 시 에러 메시지를 보여준다", async () => {
    listOpenHomepageConsultSlotsMock.mockRejectedValue(new Error("네트워크 오류"));
    render(<ConsultAvailabilityMonthView timezone="UTC" {...noopProps} />);
    await waitFor(() => expect(screen.getByText("네트워크 오류")).toBeInTheDocument());
  });
});
