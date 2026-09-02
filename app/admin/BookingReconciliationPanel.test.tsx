import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingReconciliationPanel from "./BookingReconciliationPanel";
import * as actions from "./booking-actions";

vi.mock("./booking-actions", () => ({
  listReconciliationNeededBookings: vi.fn(),
  retryCalendarSyncNow: vi.fn(),
  adminCancelLessonBooking: vi.fn(),
  listNotificationOutboxSummary: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(actions.listNotificationOutboxSummary).mockResolvedValue([]);
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
});
