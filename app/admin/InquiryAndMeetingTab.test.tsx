import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listInquiryThreadsForAdminMock,
  sendAdminHouseholdMessageMock,
  resolveHouseholdInquiryThreadMock,
  markHouseholdMessengerReadByAdminMock,
  loadMeetingOperationsDashboardActionMock,
  updateMeetingRequestStatusMock,
  addMeetingAvailabilityRuleMock,
  deactivateMeetingAvailabilityRuleMock,
  addMeetingAvailabilityExceptionMock,
  removeMeetingAvailabilityExceptionMock,
  listMeetingRequestMessagesForAdminMock,
  sendAdminMeetingRequestMessageMock,
} = vi.hoisted(() => ({
  listInquiryThreadsForAdminMock: vi.fn(),
  sendAdminHouseholdMessageMock: vi.fn(),
  resolveHouseholdInquiryThreadMock: vi.fn(),
  markHouseholdMessengerReadByAdminMock: vi.fn(),
  loadMeetingOperationsDashboardActionMock: vi.fn(),
  updateMeetingRequestStatusMock: vi.fn(),
  addMeetingAvailabilityRuleMock: vi.fn(),
  deactivateMeetingAvailabilityRuleMock: vi.fn(),
  addMeetingAvailabilityExceptionMock: vi.fn(),
  removeMeetingAvailabilityExceptionMock: vi.fn(),
  listMeetingRequestMessagesForAdminMock: vi.fn(),
  sendAdminMeetingRequestMessageMock: vi.fn(),
}));

// 2026-09-10(P1-2) — "면담 운영" 서브탭은 이제 loadMeetingOperationsDashboardAction()
// 하나만 호출한다(면담 요청·가용 규칙·예외일을 한 번에 반환).
vi.mock("./inquiry-and-meeting-actions", () => ({
  listInquiryThreadsForAdmin: listInquiryThreadsForAdminMock,
  sendAdminHouseholdMessage: sendAdminHouseholdMessageMock,
  resolveHouseholdInquiryThread: resolveHouseholdInquiryThreadMock,
  markHouseholdMessengerReadByAdmin: markHouseholdMessengerReadByAdminMock,
  loadMeetingOperationsDashboardAction: loadMeetingOperationsDashboardActionMock,
  updateMeetingRequestStatus: updateMeetingRequestStatusMock,
  addMeetingAvailabilityRule: addMeetingAvailabilityRuleMock,
  deactivateMeetingAvailabilityRule: deactivateMeetingAvailabilityRuleMock,
  addMeetingAvailabilityException: addMeetingAvailabilityExceptionMock,
  removeMeetingAvailabilityException: removeMeetingAvailabilityExceptionMock,
  listMeetingRequestMessagesForAdmin: listMeetingRequestMessagesForAdminMock,
  sendAdminMeetingRequestMessage: sendAdminMeetingRequestMessageMock,
}));

import InquiryAndMeetingTab from "./InquiryAndMeetingTab";

describe("InquiryAndMeetingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markHouseholdMessengerReadByAdminMock.mockResolvedValue(undefined);
    listMeetingRequestMessagesForAdminMock.mockResolvedValue([]);
    listInquiryThreadsForAdminMock.mockResolvedValue([
      {
        householdId: "h1",
        householdLabel: "김민지 가족",
        hasOpen: true,
        unreadForAdmin: true,
        messages: [{ id: "m1", senderRole: "guardian", body: "문의합니다", status: "open", createdAt: "2027-01-01T00:00:00.000Z" }],
      },
    ]);
    loadMeetingOperationsDashboardActionMock.mockResolvedValue({
      requests: [
        {
          id: "meet1",
          householdId: "h1",
          householdLabel: "김민지 가족",
          childName: "철수",
          subject: "성적 상담",
          content: "다음 학기 진도 상담을 요청합니다.",
          contactPreference: "phone",
          preferredContactTime: "평일 오후",
          status: "requested",
          startsAt: "2027-01-02T00:00:00.000Z",
          endsAt: null,
          googleMeetLink: null,
          createdAt: "2027-01-01T00:00:00.000Z",
        },
      ],
      rules: [],
      exceptions: [],
    });
  });

  it("메신저 탭에서 미해결 스레드를 열어 답장을 보낼 수 있다(안읽음 표시·읽음 처리 포함)", async () => {
    sendAdminHouseholdMessageMock.mockResolvedValue(undefined);
    render(<InquiryAndMeetingTab />);
    await waitFor(() => expect(screen.getByText(/김민지 가족/)).toBeInTheDocument());
    expect(screen.getByText("안읽음")).toBeInTheDocument();
    fireEvent.click(screen.getByText("열기"));
    await waitFor(() => expect(screen.getByText("문의합니다")).toBeInTheDocument());
    await waitFor(() => expect(markHouseholdMessengerReadByAdminMock).toHaveBeenCalledWith("h1"));

    fireEvent.change(screen.getByLabelText("답장 내용"), { target: { value: "확인했습니다" } });
    fireEvent.click(screen.getByText("답장"));
    await waitFor(() => expect(sendAdminHouseholdMessageMock).toHaveBeenCalledWith("h1", "확인했습니다"));
  });

  it("상담 신청 탭에서 요청을 5단계 상태로 전환할 수 있다", async () => {
    updateMeetingRequestStatusMock.mockResolvedValue(undefined);
    render(<InquiryAndMeetingTab />);
    fireEvent.click(screen.getByText("상담 신청"));
    await waitFor(() => expect(screen.getByText(/성적 상담/)).toBeInTheDocument());
    expect(screen.getByText(/다음 학기 진도 상담을 요청합니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("확인 중로 변경"));
    await waitFor(() => expect(updateMeetingRequestStatusMock).toHaveBeenCalledWith("meet1", "confirming"));
  });
});
