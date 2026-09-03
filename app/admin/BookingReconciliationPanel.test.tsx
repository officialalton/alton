import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingReconciliationPanel from "./BookingReconciliationPanel";
import * as actions from "./booking-actions";

vi.mock("./booking-actions", () => ({
  listReconciliationNeededBookings: vi.fn(),
  retryCalendarSyncNow: vi.fn(),
  adminCancelLessonBooking: vi.fn(),
  listNotificationOutboxSummary: vi.fn(),
  listRecentIncidentReports: vi.fn(),
  listExternalCalendarChanges: vi.fn(),
  resolveExternalCalendarChange: vi.fn(),
  resolveExternalChangeAcceptGoogleTime: vi.fn(),
  resolveExternalChangeKeepAltonTime: vi.fn(),
  resolveExternalChangeRecreateAfterDeletion: vi.fn(),
  resolveExternalChangeCancelDueToDeletion: vi.fn(),
  retryExternalCalendarReconciliationNow: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(actions.listNotificationOutboxSummary).mockResolvedValue([]);
  vi.mocked(actions.listRecentIncidentReports).mockResolvedValue([]);
  vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([]);
  vi.mocked(actions.retryExternalCalendarReconciliationNow).mockResolvedValue({ teachersChecked: 0, changesDetected: 0 });
});

describe("BookingReconciliationPanel", () => {
  it("불일치 예약이 없으면 빈 상태 메시지를 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("불일치 예약이 없습니다.")).toBeInTheDocument());
  });

  it("불일치 예약 목록과 상태 라벨을 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([
      {
        reservationId: "r1", teacherId: "t1", teacherName: "김선생", startsAt: "2026-10-10T19:00:00Z",
        googleSyncStatus: "reconciliation_needed", googleSyncError: "signJwt 실패", googleSyncRetryCount: 6,
      },
    ]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("김선생 선생님")).toBeInTheDocument());
    expect(screen.getByText(/수동 확인 필요/)).toBeInTheDocument();
    expect(screen.getByText(/signJwt 실패/)).toBeInTheDocument();
  });

  it("지금 재처리 버튼을 누르면 retryCalendarSyncNow를 호출하고 결과를 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.retryCalendarSyncNow).mockResolvedValue({ attempted: 3, succeeded: 2, failed: 1, reconciliationNeeded: 0 });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(actions.listReconciliationNeededBookings).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("지금 재처리"));
    await waitFor(() => expect(screen.getByText(/3건 재시도/)).toBeInTheDocument());
    expect(actions.retryCalendarSyncNow).toHaveBeenCalled();
  });

  it("취소 버튼 클릭 시 인라인 입력값으로 adminCancelLessonBooking을 호출한다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([
      {
        reservationId: "r1", teacherId: "t1", teacherName: "김선생", startsAt: "2026-10-10T19:00:00Z",
        googleSyncStatus: "failed", googleSyncError: null, googleSyncRetryCount: 2,
      },
    ]);
    vi.mocked(actions.adminCancelLessonBooking).mockResolvedValue(undefined);

    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("김선생 선생님")).toBeInTheDocument());

    fireEvent.click(screen.getByText("이 예약 취소(회사 귀책)"));
    fireEvent.change(screen.getByPlaceholderText("예: Google Workspace 계정 미발급"), {
      target: { value: "Google 계정 문제로 취소" },
    });
    fireEvent.click(screen.getByText("취소 확정"));

    await waitFor(() =>
      expect(actions.adminCancelLessonBooking).toHaveBeenCalledWith({
        reservationId: "r1", cancelledByRole: "company", reason: "Google 계정 문제로 취소",
      })
    );
  });

  it("알림 outbox 요약을 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listNotificationOutboxSummary).mockResolvedValue([
      { notificationType: "reminder_24h", status: "pending", count: 5 },
      { notificationType: "booking_cancelled", status: "cancelled", count: 2 },
    ]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText(/24시간 전 리마인드/)).toBeInTheDocument());
    expect(screen.getByText(/24시간 전 리마인드 · pending 5건/)).toBeInTheDocument();
  });

  it("지각·노쇼 신고가 없으면 빈 상태 메시지를 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("제출된 신고가 없습니다.")).toBeInTheDocument());
  });

  it("지각·노쇼 신고 목록을 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listRecentIncidentReports).mockResolvedValue([
      {
        id: "ir1", sessionId: "s1", reportType: "teacher_late", reportedByName: "학생1",
        studentName: "학생1", teacherName: "선생님1", minutesLate: 15, notes: "늦게 들어오셨어요",
        reportedAt: "2026-09-01T10:00:00Z",
      },
    ]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText(/학생1 · 선생님1 선생님/)).toBeInTheDocument());
    expect(screen.getByText("선생님 지각")).toBeInTheDocument();
    expect(screen.getByText(/지각 15분/)).toBeInTheDocument();
    expect(screen.getByText("늦게 들어오셨어요")).toBeInTheDocument();
  });

  it("외부 변경이 없으면 빈 상태 메시지를 보여준다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("감지된 외부 변경이 없습니다.")).toBeInTheDocument());
  });

  it("외부 변경 목록을 보여주고, 무시 처리하면 resolveExternalCalendarChange가 호출된다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([
      {
        reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
        externalChangeStatus: "time_changed", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
        externalChangeDetail: { google_starts_at: "2026-10-01T20:00:00Z" },
      },
    ]);
    vi.mocked(actions.resolveExternalCalendarChange).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("Google에서 시간 변경됨")).toBeInTheDocument());

    fireEvent.click(screen.getByText("확인 처리"));
    fireEvent.click(screen.getByText("무시(오탐)"));

    await waitFor(() =>
      expect(actions.resolveExternalCalendarChange).toHaveBeenCalledWith({
        reservationId: "r1", resolution: "dismissed", reason: "관리자 확인",
      })
    );
  });

  it("time_changed 감지 시 'Google 시간 반영'을 누르면 resolveExternalChangeAcceptGoogleTime이 호출된다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([
      {
        reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
        externalChangeStatus: "time_changed", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
        externalChangeDetail: { google_starts_at: "2026-10-01T20:00:00Z" },
      },
    ]);
    vi.mocked(actions.resolveExternalChangeAcceptGoogleTime).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("Google에서 시간 변경됨")).toBeInTheDocument());

    fireEvent.click(screen.getByText("확인 처리"));
    fireEvent.click(screen.getByText("Google 시간 반영"));

    await waitFor(() =>
      expect(actions.resolveExternalChangeAcceptGoogleTime).toHaveBeenCalledWith({ reservationId: "r1", reason: "관리자 확인" })
    );
  });

  it("'ALTON 시간 유지'를 누르면 resolveExternalChangeKeepAltonTime이 호출된다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([
      {
        reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
        externalChangeStatus: "time_changed", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
        externalChangeDetail: null,
      },
    ]);
    vi.mocked(actions.resolveExternalChangeKeepAltonTime).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("Google에서 시간 변경됨")).toBeInTheDocument());

    fireEvent.click(screen.getByText("확인 처리"));
    fireEvent.click(screen.getByText("ALTON 시간 유지"));

    await waitFor(() =>
      expect(actions.resolveExternalChangeKeepAltonTime).toHaveBeenCalledWith({ reservationId: "r1", reason: "관리자 확인" })
    );
  });

  it("deleted 감지에는 'ALTON 시간 유지'/'Google 시간 반영'/'무시' 대신 재생성·취소 버튼만 보인다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([
      {
        reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
        externalChangeStatus: "deleted", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
        externalChangeDetail: null,
      },
    ]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("Google에서 이벤트 삭제됨")).toBeInTheDocument());
    fireEvent.click(screen.getByText("확인 처리"));
    expect(screen.queryByText("Google 시간 반영")).not.toBeInTheDocument();
    expect(screen.queryByText("ALTON 시간 유지")).not.toBeInTheDocument();
    expect(screen.queryByText("무시(오탐)")).not.toBeInTheDocument();
    expect(screen.getByText("ALTON 일정 유지(재생성)")).toBeInTheDocument();
    expect(screen.getByText("예약 취소")).toBeInTheDocument();
  });

  it("deleted 감지에서 'ALTON 일정 유지(재생성)'을 누르면 resolveExternalChangeRecreateAfterDeletion이 호출된다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([
      {
        reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
        externalChangeStatus: "deleted", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
        externalChangeDetail: null,
      },
    ]);
    vi.mocked(actions.resolveExternalChangeRecreateAfterDeletion).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("Google에서 이벤트 삭제됨")).toBeInTheDocument());
    fireEvent.click(screen.getByText("확인 처리"));
    fireEvent.click(screen.getByText("ALTON 일정 유지(재생성)"));
    await waitFor(() =>
      expect(actions.resolveExternalChangeRecreateAfterDeletion).toHaveBeenCalledWith({ reservationId: "r1", reason: "관리자 확인" })
    );
  });

  it("deleted 감지에서 '예약 취소'를 누르면 resolveExternalChangeCancelDueToDeletion이 호출된다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.listExternalCalendarChanges).mockResolvedValue([
      {
        reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
        externalChangeStatus: "deleted", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
        externalChangeDetail: null,
      },
    ]);
    vi.mocked(actions.resolveExternalChangeCancelDueToDeletion).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("Google에서 이벤트 삭제됨")).toBeInTheDocument());
    fireEvent.click(screen.getByText("확인 처리"));
    fireEvent.click(screen.getByText("예약 취소"));
    await waitFor(() =>
      expect(actions.resolveExternalChangeCancelDueToDeletion).toHaveBeenCalledWith({ reservationId: "r1", reason: "관리자 확인" })
    );
  });

  it("지금 재처리 버튼은 외부 변경 대조도 함께 실행하고 결과를 메시지에 포함한다", async () => {
    vi.mocked(actions.listReconciliationNeededBookings).mockResolvedValue([]);
    vi.mocked(actions.retryCalendarSyncNow).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, reconciliationNeeded: 0 });
    vi.mocked(actions.retryExternalCalendarReconciliationNow).mockResolvedValue({ teachersChecked: 2, changesDetected: 1 });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("지금 재처리")).toBeInTheDocument());
    fireEvent.click(screen.getByText("지금 재처리"));
    await waitFor(() => expect(screen.getByText(/외부 변경 대조: 선생님 2명 확인, 신규 감지 1건/)).toBeInTheDocument());
  });
});
