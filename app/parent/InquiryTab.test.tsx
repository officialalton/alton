import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listGuardianHouseholdMessagesMock,
  sendGuardianHouseholdMessageMock,
  listGuardianMeetingRequestsMock,
  listGuardianChildrenForMeetingMock,
  listOpenGuardianMeetingSlotsMock,
  submitMeetingRequestMock,
} = vi.hoisted(() => ({
  listGuardianHouseholdMessagesMock: vi.fn(),
  sendGuardianHouseholdMessageMock: vi.fn(),
  listGuardianMeetingRequestsMock: vi.fn(),
  listGuardianChildrenForMeetingMock: vi.fn(),
  listOpenGuardianMeetingSlotsMock: vi.fn(),
  submitMeetingRequestMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  listGuardianHouseholdMessages: listGuardianHouseholdMessagesMock,
  sendGuardianHouseholdMessage: sendGuardianHouseholdMessageMock,
  listGuardianMeetingRequests: listGuardianMeetingRequestsMock,
  listGuardianChildrenForMeeting: listGuardianChildrenForMeetingMock,
  listOpenGuardianMeetingSlots: listOpenGuardianMeetingSlotsMock,
  submitMeetingRequest: submitMeetingRequestMock,
}));

import InquiryTab from "./InquiryTab";

describe("InquiryTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGuardianHouseholdMessagesMock.mockResolvedValue([]);
    listGuardianMeetingRequestsMock.mockResolvedValue([]);
    listGuardianChildrenForMeetingMock.mockResolvedValue([{ id: "child1", name: "철수" }]);
    listOpenGuardianMeetingSlotsMock.mockResolvedValue([]);
  });

  it("문의 내역과 면담 목록을 불러온다", async () => {
    listGuardianHouseholdMessagesMock.mockResolvedValue([
      { id: "m1", senderId: "admin1", senderRole: "admin", body: "안녕하세요", status: "open", createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    render(<InquiryTab />);
    await waitFor(() => expect(screen.getByText("안녕하세요")).toBeInTheDocument());
  });

  it("문의를 작성해 전송하면 sendGuardianHouseholdMessage가 호출되고 목록을 다시 불러온다", async () => {
    render(<InquiryTab />);
    await waitFor(() => expect(listGuardianHouseholdMessagesMock).toHaveBeenCalledTimes(1));
    sendGuardianHouseholdMessageMock.mockResolvedValue(undefined);

    fireEvent.change(screen.getByLabelText("문의 내용"), { target: { value: "새 문의입니다" } });
    fireEvent.click(screen.getByText("전송"));

    await waitFor(() => expect(sendGuardianHouseholdMessageMock).toHaveBeenCalledWith("새 문의입니다"));
    await waitFor(() => expect(listGuardianHouseholdMessagesMock).toHaveBeenCalledTimes(2));
  });

  it("면담 요청 폼을 열어 슬롯 없이 제출하면 에러를 보여준다", async () => {
    render(<InquiryTab />);
    await waitFor(() => expect(listGuardianChildrenForMeetingMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ 면담 요청"));
    fireEvent.click(screen.getByText("면담 요청하기"));
    await waitFor(() => expect(screen.getByText("면담 희망 시간을 선택해주세요.")).toBeInTheDocument());
    expect(submitMeetingRequestMock).not.toHaveBeenCalled();
  });
});
