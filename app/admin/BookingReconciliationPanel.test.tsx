import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingReconciliationPanel from "./BookingReconciliationPanel";
import * as actions from "./booking-actions";
import type { BookingReconciliationDashboard } from "./booking-actions";

// 2026-09-10(P1-2) — 이 화면은 이제 8개 개별 서버 액션 대신
// loadBookingReconciliationDashboardAction() 하나를 호출한다(인증도 그 안에서
// 한 번만). 테스트도 이 단일 액션을 목으로 대체하고, 기본값을 빈 배열로 채운
// 대시보드 객체를 각 테스트가 필요한 필드만 덮어써서 사용한다.

vi.mock("./booking-actions", () => ({
  loadBookingReconciliationDashboardAction: vi.fn(),
  retryCalendarSyncNow: vi.fn(),
  adminCancelLessonBooking: vi.fn(),
  resolveExternalCalendarChange: vi.fn(),
  resolveExternalChangeAcceptGoogleTime: vi.fn(),
  resolveExternalChangeKeepAltonTime: vi.fn(),
  resolveExternalChangeRecreateAfterDeletion: vi.fn(),
  resolveExternalChangeCancelDueToDeletion: vi.fn(),
  retryExternalCalendarReconciliationNow: vi.fn(),
  adminFinalizeLessonSession: vi.fn(),
  adminReopenSession: vi.fn(),
  adminFinalizeSessionAsInfraIncident: vi.fn(),
  adminApplyMakeupTimeToBooking: vi.fn(),
  resolveSessionJudgmentReconciliationTask: vi.fn(),
  setReconciliationTaskStudentCancelledDisposition: vi.fn(),
}));

const EMPTY_DASHBOARD: BookingReconciliationDashboard = {
  reconciliationNeeded: [],
  outboxSummary: [],
  incidentReports: [],
  externalChanges: [],
  sessionsNeedingJudgment: [],
  recentlyFinalized: [],
  makeupObligations: [],
  reconciliationTasks: [],
};

function mockDashboard(overrides: Partial<BookingReconciliationDashboard>) {
  vi.mocked(actions.loadBookingReconciliationDashboardAction).mockResolvedValue({
    ...EMPTY_DASHBOARD,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDashboard({});
  vi.mocked(actions.retryExternalCalendarReconciliationNow).mockResolvedValue([]);
});

describe("BookingReconciliationPanel", () => {
  it("불일치 예약이 없으면 빈 상태 메시지를 보여준다", async () => {
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("불일치 예약이 없습니다.")).toBeInTheDocument());
  });

  it("불일치 예약 목록과 상태 라벨을 보여준다", async () => {
    mockDashboard({
      reconciliationNeeded: [
        {
          reservationId: "r1", teacherId: "t1", teacherName: "김선생", startsAt: "2026-10-10T19:00:00Z",
          googleSyncStatus: "reconciliation_needed", googleSyncError: "signJwt 실패", googleSyncRetryCount: 6,
        },
      ],
    });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("김선생 선생님")).toBeInTheDocument());
    expect(screen.getByText(/수동 확인 필요/)).toBeInTheDocument();
    expect(screen.getByText(/signJwt 실패/)).toBeInTheDocument();
  });

  it("지금 재처리 버튼을 누르면 retryCalendarSyncNow를 호출하고 결과를 보여준다", async () => {
    vi.mocked(actions.retryCalendarSyncNow).mockResolvedValue({ attempted: 3, succeeded: 2, failed: 1, reconciliationNeeded: 0 });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(actions.loadBookingReconciliationDashboardAction).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("지금 재처리"));
    await waitFor(() => expect(screen.getByText(/3건 재시도/)).toBeInTheDocument());
    expect(actions.retryCalendarSyncNow).toHaveBeenCalled();
  });

  it("취소 버튼 클릭 시 인라인 입력값으로 adminCancelLessonBooking을 호출한다", async () => {
    mockDashboard({
      reconciliationNeeded: [
        {
          reservationId: "r1", teacherId: "t1", teacherName: "김선생", startsAt: "2026-10-10T19:00:00Z",
          googleSyncStatus: "failed", googleSyncError: null, googleSyncRetryCount: 2,
        },
      ],
    });
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
    mockDashboard({
      outboxSummary: [
        { notificationType: "reminder_24h", status: "pending", count: 5 },
        { notificationType: "booking_cancelled", status: "cancelled", count: 2 },
      ],
    });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText(/24시간 전 리마인드/)).toBeInTheDocument());
    expect(screen.getByText(/24시간 전 리마인드 · pending 5건/)).toBeInTheDocument();
  });

  it("지각·노쇼 신고가 없으면 빈 상태 메시지를 보여준다", async () => {
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("제출된 신고가 없습니다.")).toBeInTheDocument());
  });

  it("지각·노쇼 신고 목록을 보여준다", async () => {
    mockDashboard({
      incidentReports: [
        {
          id: "ir1", sessionId: "s1", reportType: "teacher_late", reportedByName: "학생1",
          studentName: "학생1", teacherName: "선생님1", minutesLate: 15, notes: "늦게 들어오셨어요",
          reportedAt: "2026-09-01T10:00:00Z",
        },
      ],
    });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText(/학생1 · 선생님1 선생님/)).toBeInTheDocument());
    expect(screen.getByText("선생님 지각")).toBeInTheDocument();
    expect(screen.getByText(/지각 15분/)).toBeInTheDocument();
    expect(screen.getByText("늦게 들어오셨어요")).toBeInTheDocument();
  });

  it("외부 변경이 없으면 빈 상태 메시지를 보여준다", async () => {
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("감지된 외부 변경이 없습니다.")).toBeInTheDocument());
  });

  it("외부 변경 목록을 보여주고, 무시 처리하면 resolveExternalCalendarChange가 호출된다", async () => {
    mockDashboard({
      externalChanges: [
        {
          reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
          externalChangeStatus: "time_changed", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
          externalChangeDetail: { google_starts_at: "2026-10-01T20:00:00Z" },
        },
      ],
    });
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
    mockDashboard({
      externalChanges: [
        {
          reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
          externalChangeStatus: "time_changed", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
          externalChangeDetail: { google_starts_at: "2026-10-01T20:00:00Z" },
        },
      ],
    });
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
    mockDashboard({
      externalChanges: [
        {
          reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
          externalChangeStatus: "time_changed", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
          externalChangeDetail: null,
        },
      ],
    });
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
    mockDashboard({
      externalChanges: [
        {
          reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
          externalChangeStatus: "deleted", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
          externalChangeDetail: null,
        },
      ],
    });
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
    mockDashboard({
      externalChanges: [
        {
          reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
          externalChangeStatus: "deleted", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
          externalChangeDetail: null,
        },
      ],
    });
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
    mockDashboard({
      externalChanges: [
        {
          reservationId: "r1", teacherName: "선생님1", startsAt: "2026-10-01T19:00:00Z",
          externalChangeStatus: "deleted", externalChangeDetectedAt: "2026-10-01T18:00:00Z",
          externalChangeDetail: null,
        },
      ],
    });
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
    vi.mocked(actions.retryCalendarSyncNow).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, reconciliationNeeded: 0 });
    vi.mocked(actions.retryExternalCalendarReconciliationNow).mockResolvedValue([
      { teacherId: "t1", teacherName: "선생님1", checked: true, changesDetected: 1, error: null },
      { teacherId: "t2", teacherName: "선생님2", checked: true, changesDetected: 0, error: null },
    ]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("지금 재처리")).toBeInTheDocument());
    fireEvent.click(screen.getByText("지금 재처리"));
    await waitFor(() => expect(screen.getByText(/외부 변경 대조: 선생님 2명 확인, 신규 감지 1건/)).toBeInTheDocument());
  });

  it("2026-09-10(P1-2): 지금 재처리에서 일부 선생님이 실패하면 실패 목록을 별도로 보여준다(클릭 한 번에 실패가 묻히지 않음)", async () => {
    vi.mocked(actions.retryCalendarSyncNow).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, reconciliationNeeded: 0 });
    vi.mocked(actions.retryExternalCalendarReconciliationNow).mockResolvedValue([
      { teacherId: "t1", teacherName: "선생님1", checked: true, changesDetected: 0, error: null },
      { teacherId: "t2", teacherName: "선생님2", checked: false, changesDetected: 0, error: "Calendar API 호출 실패" },
    ]);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("지금 재처리")).toBeInTheDocument());
    fireEvent.click(screen.getByText("지금 재처리"));

    await waitFor(() => expect(screen.getByText(/대조 실패 1명/)).toBeInTheDocument());
    expect(screen.getByTestId("retry-failures")).toHaveTextContent("선생님2: Calendar API 호출 실패");
    expect(screen.getByTestId("retry-failures")).not.toHaveTextContent("선생님1");
  });

  it("M5-a: 판정 대기 세션에 완료/노쇼 버튼을 누르면 adminFinalizeLessonSession이 호출된다", async () => {
    mockDashboard({
      sessionsNeedingJudgment: [
        {
          sessionId: "s1",
          reservationId: "r1",
          teacherName: "김선생",
          studentName: "지훈",
          subjectName: "SAT Math",
          startsAt: "2026-10-10T19:00:00Z",
          endsAt: "2026-10-10T21:00:00Z",
          finalStatus: "scheduled",
          isTrial: false,
          incidentReportCount: 1,
          wasReopened: false,
        },
      ],
    });
    vi.mocked(actions.adminFinalizeLessonSession).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText(/지훈 · 김선생/)).toBeInTheDocument());
    expect(screen.getByText("신고 1건")).toBeInTheDocument();

    fireEvent.click(screen.getByText("완료로 확정"));
    await waitFor(() =>
      expect(actions.adminFinalizeLessonSession).toHaveBeenCalledWith({
        sessionId: "s1",
        outcome: "completed",
        reason: "관리자 확인 — 정상 완료",
      })
    );
  });

  it("M5-a: 확정된 세션의 '재개방'을 누르면 사유 입력 후 adminReopenSession이 호출된다", async () => {
    mockDashboard({
      recentlyFinalized: [
        {
          sessionId: "s2",
          reservationId: "r2",
          teacherName: "김선생",
          studentName: "지훈",
          subjectName: "SAT Math",
          startsAt: "2026-10-09T19:00:00Z",
          endsAt: "2026-10-09T21:00:00Z",
          finalStatus: "completed",
          isTrial: false,
          incidentReportCount: 0,
          wasReopened: false,
        },
      ],
    });
    vi.mocked(actions.adminReopenSession).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("재개방(재판정 필요)")).toBeInTheDocument());
    fireEvent.click(screen.getByText("재개방(재판정 필요)"));
    fireEvent.change(screen.getByPlaceholderText(/선생님이 완료를 잘못 눌렀음/), { target: { value: "실제로는 선생님 노쇼" } });
    fireEvent.click(screen.getByText("재개방"));
    await waitFor(() =>
      expect(actions.adminReopenSession).toHaveBeenCalledWith({ sessionId: "s2", reason: "실제로는 선생님 노쇼" })
    );
  });

  it("2026-09-05: 대기 중인 대사 작업이 보이고 '반영'을 누르면 resolveSessionJudgmentReconciliationTask가 호출된다", async () => {
    mockDashboard({
      reconciliationTasks: [
        {
          taskId: "task1",
          sessionId: "s2",
          priorFinalStatus: "completed",
          newFinalStatus: "teacher_no_show",
          priorPayableMinutes: 120,
          newPayableMinutes: 0,
          currentEntitlementDisposition: "consume",
          expectedEntitlementDisposition: "release",
          requiredEntitlementAdjustmentAmount: 1,
          status: "pending",
          createdAt: "2026-09-05T00:00:00Z",
          resolvedAt: null,
          reason: "실제로는 선생님 노쇼였음",
          adminDispositionReason: null,
        },
      ],
    });
    vi.mocked(actions.resolveSessionJudgmentReconciliationTask).mockResolvedValue({ result: "resolved" });
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("반영 필요")).toBeInTheDocument());
    fireEvent.click(screen.getByText("반영"));
    await waitFor(() =>
      expect(actions.resolveSessionJudgmentReconciliationTask).toHaveBeenCalledWith({
        taskId: "task1",
        reason: "관리자 확인 후 반영",
      })
    );
  });

  it("2026-09-05: 대사 작업이 없으면 빈 상태 메시지를 보여준다", async () => {
    render(<BookingReconciliationPanel />);
    await waitFor(() => expect(screen.getByText("대사 작업이 없습니다.")).toBeInTheDocument());
  });

  it("2026-09-06: student_cancelled 자동 판정 불가 작업은 '반영' 대신 수업권 처리 방식 선택 폼을 보여주고, 확정 후에만 반영 가능하다", async () => {
    mockDashboard({
      reconciliationTasks: [
        {
          taskId: "task2",
          sessionId: "s3",
          priorFinalStatus: "completed",
          newFinalStatus: "student_cancelled",
          priorPayableMinutes: 120,
          newPayableMinutes: 0,
          currentEntitlementDisposition: "consume",
          expectedEntitlementDisposition: null,
          requiredEntitlementAdjustmentAmount: 0,
          status: "pending",
          createdAt: "2026-09-06T00:00:00Z",
          resolvedAt: null,
          reason: "학생 취소로 재판정",
          adminDispositionReason: null,
        },
      ],
    });
    vi.mocked(actions.setReconciliationTaskStudentCancelledDisposition).mockResolvedValue(undefined);
    render(<BookingReconciliationPanel />);

    await waitFor(() => expect(screen.getByText("수업권 처리 방식 선택")).toBeInTheDocument());
    expect(screen.queryByText("반영")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("수업권 처리 방식 선택"));
    fireEvent.click(screen.getByText("해제(release)"));
    fireEvent.change(screen.getByPlaceholderText("사유(필수)"), { target: { value: "취소 기록 없음 — 수동 확인" } });
    fireEvent.click(screen.getByText("확정"));

    await waitFor(() =>
      expect(actions.setReconciliationTaskStudentCancelledDisposition).toHaveBeenCalledWith({
        taskId: "task2",
        disposition: "release",
        reason: "취소 기록 없음 — 수동 확인",
      })
    );
  });
});
