import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  loadMeetingOperationsDashboardActionMock,
  updateMeetingRequestStatusMock,
  cancelAndRerequestMeetingRequestMock,
  resyncMeetingRequestCalendarMock,
} = vi.hoisted(() => ({
  loadMeetingOperationsDashboardActionMock: vi.fn(),
  updateMeetingRequestStatusMock: vi.fn(),
  cancelAndRerequestMeetingRequestMock: vi.fn(),
  resyncMeetingRequestCalendarMock: vi.fn(),
}));

// 면담 운영은 loadMeetingOperationsDashboardAction() 하나만 호출한다.
vi.mock("./inquiry-and-meeting-actions", () => ({
  loadMeetingOperationsDashboardAction: loadMeetingOperationsDashboardActionMock,
  updateMeetingRequestStatus: updateMeetingRequestStatusMock,
  cancelAndRerequestMeetingRequest: cancelAndRerequestMeetingRequestMock,
  resyncMeetingRequestCalendar: resyncMeetingRequestCalendarMock,
}));

import MeetingOperationsPanel from "./MeetingOperationsPanel";

describe("MeetingOperationsPanel(Consultants > 면담)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });
  });

  it("가용시간 UI(반복 주간 가능시간·휴무일)는 더 이상 없다", async () => {
    render(<MeetingOperationsPanel />);
    await waitFor(() => expect(screen.getByText(/성적 상담/)).toBeInTheDocument());
    expect(screen.queryByText(/가용시간/)).not.toBeInTheDocument();
    expect(screen.queryByText("휴무일 추가")).not.toBeInTheDocument();
  });

  it("조치 필요 건수를 콜백으로 알린다", async () => {
    const onCount = vi.fn();
    render(<MeetingOperationsPanel onNeedsActionCount={onCount} />);
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(1));
  });

  it("면담 요청을 5단계 상태로 전환할 수 있다", async () => {
    updateMeetingRequestStatusMock.mockResolvedValue(undefined);
    render(<MeetingOperationsPanel />);
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
      loadMeetingOperationsDashboardActionMock.mockResolvedValue({ requests, consultants: [] });

    it("확정된 미팅은 관리자 개입 후 '취소 후 재신청'을 호출한다", async () => {
      cancelAndRerequestMeetingRequestMock.mockResolvedValue({ newRequestId: "n1", calendar: "deleted" });
      load([{ ...base, id: "s1", status: "scheduled", consultantId: "c1", consultantName: "박컨설턴트", googleSyncStatus: "succeeded" }]);
      render(<MeetingOperationsPanel />);
        await waitFor(() => expect(screen.getByText("관리자 개입")).toBeInTheDocument());
      fireEvent.click(screen.getByText("관리자 개입"));
      fireEvent.click(screen.getByText("취소 후 재신청"));
      await waitFor(() => expect(cancelAndRerequestMeetingRequestMock).toHaveBeenCalledWith("s1"));
    });

    it("요청됨 상태에는 '취소 후 재신청'이 없다(배정 컨트롤을 그대로 쓴다)", async () => {
      load([{ ...base, id: "r1", status: "requested", consultantId: null, consultantName: null, googleSyncStatus: null }]);
      render(<MeetingOperationsPanel />);
        await waitFor(() => expect(screen.getByText(/성적 상담/)).toBeInTheDocument());
      expect(screen.queryByText("취소 후 재신청")).not.toBeInTheDocument();
    });

    it("동기화 실패 행은 시도 횟수·사유와 'Google 재동기화' 버튼을 보이고 누르면 액션을 호출한다", async () => {
      resyncMeetingRequestCalendarMock.mockResolvedValue("synced");
      load([{ ...base, id: "f1", status: "scheduled", consultantId: "c1", consultantName: "박", googleSyncStatus: "failed", googleSyncRetryCount: 2, googleSyncLastError: "boom" }]);
      render(<MeetingOperationsPanel />);
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
      render(<MeetingOperationsPanel />);
        await waitFor(() => expect(screen.getByTestId("sync-status-p1")).toHaveTextContent("자동 재시도 중단"));
      expect(screen.queryByTestId("sync-status-ok1")).not.toBeInTheDocument();
    });

    it("재신청으로 생긴 요청에는 이전 미팅 취소 안내가 표시된다", async () => {
      load([{ ...base, id: "n1", status: "requested", consultantId: null, consultantName: null, googleSyncStatus: null, rescheduledFromId: "old1", startsAt: null, endsAt: null }]);
      render(<MeetingOperationsPanel />);
        await waitFor(() => expect(screen.getByText(/이전 미팅을 취소하고 다시 신청한 요청/)).toBeInTheDocument());
    });
  });
});
