import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listInquiryThreadsForAdminMock,
  sendAdminHouseholdMessageMock,
  resolveHouseholdInquiryThreadMock,
  listMeetingRequestsForAdminMock,
  updateMeetingRequestStatusMock,
  listMeetingAvailabilityRulesMock,
  addMeetingAvailabilityRuleMock,
  deactivateMeetingAvailabilityRuleMock,
  listMeetingAvailabilityExceptionsMock,
  addMeetingAvailabilityExceptionMock,
  removeMeetingAvailabilityExceptionMock,
} = vi.hoisted(() => ({
  listInquiryThreadsForAdminMock: vi.fn(),
  sendAdminHouseholdMessageMock: vi.fn(),
  resolveHouseholdInquiryThreadMock: vi.fn(),
  listMeetingRequestsForAdminMock: vi.fn(),
  updateMeetingRequestStatusMock: vi.fn(),
  listMeetingAvailabilityRulesMock: vi.fn(),
  addMeetingAvailabilityRuleMock: vi.fn(),
  deactivateMeetingAvailabilityRuleMock: vi.fn(),
  listMeetingAvailabilityExceptionsMock: vi.fn(),
  addMeetingAvailabilityExceptionMock: vi.fn(),
  removeMeetingAvailabilityExceptionMock: vi.fn(),
}));

vi.mock("./inquiry-and-meeting-actions", () => ({
  listInquiryThreadsForAdmin: listInquiryThreadsForAdminMock,
  sendAdminHouseholdMessage: sendAdminHouseholdMessageMock,
  resolveHouseholdInquiryThread: resolveHouseholdInquiryThreadMock,
  listMeetingRequestsForAdmin: listMeetingRequestsForAdminMock,
  updateMeetingRequestStatus: updateMeetingRequestStatusMock,
  listMeetingAvailabilityRules: listMeetingAvailabilityRulesMock,
  addMeetingAvailabilityRule: addMeetingAvailabilityRuleMock,
  deactivateMeetingAvailabilityRule: deactivateMeetingAvailabilityRuleMock,
  listMeetingAvailabilityExceptions: listMeetingAvailabilityExceptionsMock,
  addMeetingAvailabilityException: addMeetingAvailabilityExceptionMock,
  removeMeetingAvailabilityException: removeMeetingAvailabilityExceptionMock,
}));

import InquiryAndMeetingTab from "./InquiryAndMeetingTab";

describe("InquiryAndMeetingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInquiryThreadsForAdminMock.mockResolvedValue([
      { householdId: "h1", householdLabel: "김민지 가족", hasOpen: true, messages: [{ id: "m1", senderRole: "guardian", body: "문의합니다", status: "open", createdAt: "2027-01-01T00:00:00.000Z" }] },
    ]);
    listMeetingRequestsForAdminMock.mockResolvedValue([
      { id: "meet1", householdLabel: "김민지 가족", childName: "철수", subject: "성적 상담", status: "requested", startsAt: "2027-01-02T00:00:00.000Z", endsAt: null, googleMeetLink: null, createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    listMeetingAvailabilityRulesMock.mockResolvedValue([]);
    listMeetingAvailabilityExceptionsMock.mockResolvedValue([]);
  });

  it("문의함 탭에서 미해결 스레드를 열어 답장을 보낼 수 있다", async () => {
    sendAdminHouseholdMessageMock.mockResolvedValue(undefined);
    render(<InquiryAndMeetingTab />);
    await waitFor(() => expect(screen.getByText(/김민지 가족/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("열기"));
    await waitFor(() => expect(screen.getByText("문의합니다")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("답장 내용"), { target: { value: "확인했습니다" } });
    fireEvent.click(screen.getByText("답장"));
    await waitFor(() => expect(sendAdminHouseholdMessageMock).toHaveBeenCalledWith("h1", "확인했습니다"));
  });

  it("면담 운영 탭에서 면담 요청을 확정 처리할 수 있다", async () => {
    updateMeetingRequestStatusMock.mockResolvedValue(undefined);
    render(<InquiryAndMeetingTab />);
    fireEvent.click(screen.getByText("면담 운영"));
    await waitFor(() => expect(screen.getByText(/성적 상담/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("확정 처리"));
    await waitFor(() => expect(updateMeetingRequestStatusMock).toHaveBeenCalledWith("meet1", "scheduled"));
  });
});
