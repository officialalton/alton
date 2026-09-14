import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const listOpenGuardianConsultSlotsMock = vi.fn();
const listGuardianConsultRequestsActionMock = vi.fn();
const submitGuardianConsultRequestMock = vi.fn();

vi.mock("./consult-request-actions", () => ({
  listOpenGuardianConsultSlots: (...args: unknown[]) => listOpenGuardianConsultSlotsMock(...args),
  listGuardianConsultRequestsAction: (...args: unknown[]) => listGuardianConsultRequestsActionMock(...args),
  submitGuardianConsultRequest: (...args: unknown[]) => submitGuardianConsultRequestMock(...args),
}));

import ConsultRequestTab from "./ConsultRequestTab";

describe("ConsultRequestTab", () => {
  it("자녀 추가 버튼으로 입력 행을 늘리고 줄일 수 있다", async () => {
    listOpenGuardianConsultSlotsMock.mockResolvedValue([]);
    listGuardianConsultRequestsActionMock.mockResolvedValue([]);

    render(<ConsultRequestTab />);
    await waitFor(() => expect(screen.getByText("신청 이력이 없습니다.")).toBeInTheDocument());

    expect(screen.getByLabelText("자녀 1 이름")).toBeInTheDocument();
    expect(screen.queryByLabelText("자녀 2 이름")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("+ 자녀 추가"));
    fireEvent.click(screen.getByText("+ 자녀 추가"));
    expect(screen.getByLabelText("자녀 3 이름")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("삭제")[0]);
    expect(screen.queryByLabelText("자녀 3 이름")).not.toBeInTheDocument();
    expect(screen.getByLabelText("자녀 2 이름")).toBeInTheDocument();
  });

  it("이력에 상태별 라벨과 자녀 이름을 표시한다", async () => {
    listOpenGuardianConsultSlotsMock.mockResolvedValue([]);
    listGuardianConsultRequestsActionMock.mockResolvedValue([
      {
        id: "c1",
        status: "requested",
        requestedChildren: [{ name: "철수" }, { name: "영희" }],
        startsAt: "2027-01-01T09:00:00.000Z",
        scheduledAt: null,
        completedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        googleMeetLink: null,
        adminReviewSummary: null,
        requestedAt: "2026-12-01T00:00:00.000Z",
      },
    ]);

    render(<ConsultRequestTab />);
    await waitFor(() => expect(screen.getByText("승인 대기")).toBeInTheDocument());
    expect(screen.getByText("자녀: 철수, 영희")).toBeInTheDocument();
  });

  it("슬롯 미선택 시 제출을 막고 에러를 보여준다", async () => {
    listOpenGuardianConsultSlotsMock.mockResolvedValue([]);
    listGuardianConsultRequestsActionMock.mockResolvedValue([]);

    render(<ConsultRequestTab />);
    await waitFor(() => expect(screen.getByText("신청 이력이 없습니다.")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("자녀 1 이름"), { target: { value: "철수" } });
    fireEvent.click(screen.getByText("상담 신청하기"));

    expect(await screen.findByText("상담 희망 시간을 선택해주세요.")).toBeInTheDocument();
    expect(submitGuardianConsultRequestMock).not.toHaveBeenCalled();
  });
});
