import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listInquiryThreadsForAdminMock,
  sendAdminInquiryMessageMock,
  closeHouseholdInquiryMock,
  markHouseholdMessengerReadByAdminMock,
  loadMeetingOperationsDashboardActionMock,
  updateMeetingRequestStatusMock,
  addMeetingAvailabilityRuleMock,
  deactivateMeetingAvailabilityRuleMock,
  addMeetingAvailabilityExceptionMock,
  removeMeetingAvailabilityExceptionMock,
  listMeetingRequestMessagesForAdminMock,
  sendAdminMeetingRequestMessageMock,
  cancelAndRerequestMeetingRequestMock,
  resyncMeetingRequestCalendarMock,
} = vi.hoisted(() => ({
  listInquiryThreadsForAdminMock: vi.fn(),
  sendAdminInquiryMessageMock: vi.fn(),
  closeHouseholdInquiryMock: vi.fn(),
  markHouseholdMessengerReadByAdminMock: vi.fn(),
  loadMeetingOperationsDashboardActionMock: vi.fn(),
  updateMeetingRequestStatusMock: vi.fn(),
  addMeetingAvailabilityRuleMock: vi.fn(),
  deactivateMeetingAvailabilityRuleMock: vi.fn(),
  addMeetingAvailabilityExceptionMock: vi.fn(),
  removeMeetingAvailabilityExceptionMock: vi.fn(),
  listMeetingRequestMessagesForAdminMock: vi.fn(),
  sendAdminMeetingRequestMessageMock: vi.fn(),
  cancelAndRerequestMeetingRequestMock: vi.fn(),
  resyncMeetingRequestCalendarMock: vi.fn(),
}));

// 2026-09-10(P1-2) — "면담 운영" 서브탭은 이제 loadMeetingOperationsDashboardAction()
// 하나만 호출한다(면담 요청·가용 규칙·예외일을 한 번에 반환).
vi.mock("./inquiry-and-meeting-actions", () => ({
  listInquiryThreadsForAdmin: listInquiryThreadsForAdminMock,
  sendAdminInquiryMessage: sendAdminInquiryMessageMock,
  closeHouseholdInquiry: closeHouseholdInquiryMock,
  markHouseholdMessengerReadByAdmin: markHouseholdMessengerReadByAdminMock,
  loadMeetingOperationsDashboardAction: loadMeetingOperationsDashboardActionMock,
  updateMeetingRequestStatus: updateMeetingRequestStatusMock,
  addMeetingAvailabilityRule: addMeetingAvailabilityRuleMock,
  deactivateMeetingAvailabilityRule: deactivateMeetingAvailabilityRuleMock,
  addMeetingAvailabilityException: addMeetingAvailabilityExceptionMock,
  removeMeetingAvailabilityException: removeMeetingAvailabilityExceptionMock,
  listMeetingRequestMessagesForAdmin: listMeetingRequestMessagesForAdminMock,
  sendAdminMeetingRequestMessage: sendAdminMeetingRequestMessageMock,
  cancelAndRerequestMeetingRequest: cancelAndRerequestMeetingRequestMock,
  resyncMeetingRequestCalendar: resyncMeetingRequestCalendarMock,
}));

import InquiryAndMeetingTab from "./InquiryAndMeetingTab";

describe("InquiryAndMeetingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markHouseholdMessengerReadByAdminMock.mockResolvedValue(undefined);
    listMeetingRequestMessagesForAdminMock.mockResolvedValue([]);
    listInquiryThreadsForAdminMock.mockResolvedValue([
      {
        inquiryId: "i1",
        householdId: "h1",
        householdLabel: "김민지 가족",
        status: "open",
        lastMessageAt: "2027-01-01T00:00:00.000Z",
        unreadForAdmin: true,
        messages: [{ id: "m1", senderRole: "guardian", body: "문의합니다", createdAt: "2027-01-01T00:00:00.000Z" }],
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

  it("메신저 탭에서 진행 중 문의를 열어 답장을 보낼 수 있다(안읽음 표시·읽음 처리 포함)", async () => {
    sendAdminInquiryMessageMock.mockResolvedValue(undefined);
    render(<InquiryAndMeetingTab />);
    await waitFor(() => expect(screen.getByText(/김민지 가족/)).toBeInTheDocument());
    expect(screen.getByText("안읽음")).toBeInTheDocument();
    fireEvent.click(screen.getByText("열기"));
    await waitFor(() => expect(screen.getByText("문의합니다")).toBeInTheDocument());
    await waitFor(() => expect(markHouseholdMessengerReadByAdminMock).toHaveBeenCalledWith("h1"));

    fireEvent.change(screen.getByLabelText("답장 내용"), { target: { value: "확인했습니다" } });
    fireEvent.click(screen.getByText("답장"));
    await waitFor(() => expect(sendAdminInquiryMessageMock).toHaveBeenCalledWith("i1", "h1", "확인했습니다"));
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

  describe("미팅 취소 후 재신청 · Google 재동기화 (2026-09-29)", () => {
    const base = {
      householdId: "h1",
      householdLabel: "김민지 가족",
      childName: "철수",
      subject: "성적 상담",
      content: null,
      contactPreference: null,
      preferredContactTime: null,
      startsAt: "2027-01-02T00:00:00.000Z",
      endsAt: "2027-01-02T01:00:00.000Z",
      googleMeetLink: null,
      createdAt: "2027-01-01T00:00:00.000Z",
      suggestedConsultantId: null,
      googleSyncRetryCount: 0,
      googleSyncLastError: null,
      rescheduledFromId: null,
    };
    const load = (requests: unknown[]) =>
      loadMeetingOperationsDashboardActionMock.mockResolvedValue({ requests, consultants: [], rules: [], exceptions: [] });

    it("확정된 미팅은 관리자 개입 후 '취소 후 재신청'을 호출한다", async () => {
      cancelAndRerequestMeetingRequestMock.mockResolvedValue({ newRequestId: "n1", calendar: "deleted" });
      load([{ ...base, id: "s1", status: "scheduled", consultantId: "c1", consultantName: "박컨설턴트", googleSyncStatus: "succeeded" }]);
      render(<InquiryAndMeetingTab />);
      fireEvent.click(screen.getByText("상담 신청"));
      await waitFor(() => expect(screen.getByText("관리자 개입")).toBeInTheDocument());
      fireEvent.click(screen.getByText("관리자 개입"));
      fireEvent.click(screen.getByText("취소 후 재신청"));
      await waitFor(() => expect(cancelAndRerequestMeetingRequestMock).toHaveBeenCalledWith("s1"));
    });

    it("요청됨 상태에는 '취소 후 재신청'이 없다(배정 컨트롤을 그대로 쓴다)", async () => {
      load([{ ...base, id: "r1", status: "requested", consultantId: null, consultantName: null, googleSyncStatus: null }]);
      render(<InquiryAndMeetingTab />);
      fireEvent.click(screen.getByText("상담 신청"));
      await waitFor(() => expect(screen.getByText(/성적 상담/)).toBeInTheDocument());
      expect(screen.queryByText("취소 후 재신청")).not.toBeInTheDocument();
    });

    it("동기화 실패 행은 시도 횟수·사유와 'Google 재동기화' 버튼을 보이고 누르면 액션을 호출한다", async () => {
      resyncMeetingRequestCalendarMock.mockResolvedValue("synced");
      load([{ ...base, id: "f1", status: "scheduled", consultantId: "c1", consultantName: "박", googleSyncStatus: "failed", googleSyncRetryCount: 2, googleSyncLastError: "boom" }]);
      render(<InquiryAndMeetingTab />);
      fireEvent.click(screen.getByText("상담 신청"));
      await waitFor(() => expect(screen.getByTestId("sync-status-f1")).toHaveTextContent("2/5회"));
      expect(screen.getByTestId("sync-status-f1")).toHaveTextContent("boom");
      fireEvent.click(screen.getByText("Google 재동기화"));
      await waitFor(() => expect(resyncMeetingRequestCalendarMock).toHaveBeenCalledWith("f1"));
    });

    it("5회 실패(reconciliation_needed)는 자동 재시도 중단으로 표시하고, 성공 행에는 패널이 없다", async () => {
      load([
        { ...base, id: "p1", status: "scheduled", consultantId: "c1", consultantName: "박", googleSyncStatus: "reconciliation_needed", googleSyncRetryCount: 5, googleSyncLastError: "x" },
        { ...base, id: "ok1", status: "scheduled", consultantId: "c1", consultantName: "박", googleSyncStatus: "succeeded" },
      ]);
      render(<InquiryAndMeetingTab />);
      fireEvent.click(screen.getByText("상담 신청"));
      await waitFor(() => expect(screen.getByTestId("sync-status-p1")).toHaveTextContent("자동 재시도 중단"));
      expect(screen.queryByTestId("sync-status-ok1")).not.toBeInTheDocument();
    });

    it("재신청으로 생긴 요청에는 이전 미팅 취소 안내가 표시된다", async () => {
      load([{ ...base, id: "n1", status: "requested", consultantId: null, consultantName: null, googleSyncStatus: null, rescheduledFromId: "old1", startsAt: null, endsAt: null }]);
      render(<InquiryAndMeetingTab />);
      fireEvent.click(screen.getByText("상담 신청"));
      await waitFor(() => expect(screen.getByText(/이전 미팅을 취소하고 다시 신청한 요청/)).toBeInTheDocument());
    });
  });
});
