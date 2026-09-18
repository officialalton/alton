import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listGuardianMeetingRequestsMock,
  listGuardianChildrenForMeetingMock,
  listOpenGuardianMeetingSlotsMock,
  submitMeetingRequestMock,
  listMeetingRequestMessagesMock,
  sendMeetingRequestMessageMock,
} = vi.hoisted(() => ({
  listGuardianMeetingRequestsMock: vi.fn(),
  listGuardianChildrenForMeetingMock: vi.fn(),
  listOpenGuardianMeetingSlotsMock: vi.fn(),
  submitMeetingRequestMock: vi.fn(),
  listMeetingRequestMessagesMock: vi.fn(),
  sendMeetingRequestMessageMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  listGuardianMeetingRequests: listGuardianMeetingRequestsMock,
  listGuardianChildrenForMeeting: listGuardianChildrenForMeetingMock,
  listOpenGuardianMeetingSlots: listOpenGuardianMeetingSlotsMock,
  submitMeetingRequest: submitMeetingRequestMock,
  listMeetingRequestMessages: listMeetingRequestMessagesMock,
  sendMeetingRequestMessage: sendMeetingRequestMessageMock,
}));

import ConsultationRequestTab from "./ConsultationRequestTab";

describe("ConsultationRequestTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGuardianMeetingRequestsMock.mockResolvedValue([]);
    listGuardianChildrenForMeetingMock.mockResolvedValue([{ id: "child1", name: "철수" }]);
    listOpenGuardianMeetingSlotsMock.mockResolvedValue([]);
  });

  it("상담 신청 내역을 불러온다", async () => {
    listGuardianMeetingRequestsMock.mockResolvedValue([
      {
        id: "mr1",
        childId: "child1",
        childName: "철수",
        subject: "성적 상담",
        content: "요즘 수학 성적이 걱정됩니다",
        contactPreference: "either",
        preferredContactTime: null,
        status: "requested",
        startsAt: null,
        endsAt: null,
        googleMeetLink: null,
        createdAt: "2027-01-01T00:00:00.000Z",
      },
    ]);
    render(<ConsultationRequestTab />);
    await waitFor(() => expect(screen.getByText("신청됨")).toBeInTheDocument());
    expect(screen.getByText(/요즘 수학 성적이 걱정됩니다/)).toBeInTheDocument();
  });

  it("내용 없이 제출하면 에러를 보여주고 submitMeetingRequest는 호출되지 않는다", async () => {
    render(<ConsultationRequestTab />);
    await waitFor(() => expect(listGuardianChildrenForMeetingMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ 상담 신청"));
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(screen.getByText("상담 내용을 입력해주세요.")).toBeInTheDocument());
    expect(submitMeetingRequestMock).not.toHaveBeenCalled();
  });

  it("내용을 입력해 제출하면 submitMeetingRequest가 호출되고 목록을 새로고침한다", async () => {
    submitMeetingRequestMock.mockResolvedValue({ ok: true });
    render(<ConsultationRequestTab />);
    await waitFor(() => expect(listGuardianChildrenForMeetingMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ 상담 신청"));
    fireEvent.change(screen.getByLabelText("상담 내용"), { target: { value: "상담 내용입니다" } });
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() =>
      expect(submitMeetingRequestMock).toHaveBeenCalledWith(expect.objectContaining({ content: "상담 내용입니다" }))
    );
    await waitFor(() => expect(listGuardianMeetingRequestsMock).toHaveBeenCalledTimes(2));
  });
});
