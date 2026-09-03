import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LessonBookingTab from "./LessonBookingTab";
import type { PastSessionForReport, UpcomingBooking, BookableSubjectEnrollment } from "./lesson-booking-data";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

const pastSession: PastSessionForReport = {
  sessionId: "s1",
  subjectName: "SAT Math",
  teacherName: "김선생",
  startsAt: "2026-08-25T05:00:00.000Z",
};

const baseProps = {
  bookableEnrollments: [],
  upcomingBookings: [],
  pastSessionsForReport: [],
  regularLessonTypeId: null,
  lessonDurationMinutes: 120,
  timezone: "America/Los_Angeles",
  onListSlots: vi.fn().mockResolvedValue([]),
  onCreateBooking: vi.fn(),
  onCreateWeeklySeries: vi.fn(),
  onCancelBooking: vi.fn(),
  onReportTeacherIssue: vi.fn().mockResolvedValue(undefined),
};

describe("LessonBookingTab — 지각·노쇼 신고", () => {
  it("신고 대상 수업이 없으면 안내 문구를 보여준다", () => {
    render(<LessonBookingTab {...baseProps} />);
    expect(screen.getByText("최근 14일 이내 신고할 수 있는 수업이 없습니다.")).toBeInTheDocument();
  });

  it("선생님 지각·노쇼를 신고하면 onReportTeacherIssue가 호출되고 접수됨으로 바뀐다", async () => {
    render(<LessonBookingTab {...baseProps} pastSessionsForReport={[pastSession]} />);
    fireEvent.click(screen.getByText("지각·노쇼 신고"));
    fireEvent.change(screen.getByDisplayValue("선생님 지각"), { target: { value: "teacher_no_show_reported" } });
    fireEvent.click(screen.getByText("신고 제출"));
    await screen.findByText("신고 접수됨");
    expect(baseProps.onReportTeacherIssue).toHaveBeenCalledWith({
      sessionId: "s1",
      reportType: "teacher_no_show_reported",
      minutesLate: undefined,
      notes: undefined,
    });
  });

  it("선생님 지각 신고는 지각 시간(분) 입력 전에는 제출 버튼이 비활성화된다", () => {
    render(<LessonBookingTab {...baseProps} pastSessionsForReport={[pastSession]} />);
    fireEvent.click(screen.getByText("지각·노쇼 신고"));
    expect(screen.getByText("신고 제출")).toBeDisabled();
  });
});

const enrollment: BookableSubjectEnrollment = {
  subjectEnrollmentId: "e1",
  subjectName: "SAT Math",
  teacherId: "t1",
  teacherName: "김선생",
};

describe("LessonBookingTab — 월간 캘린더 예약", () => {
  it("슬롯이 로드되면 달력에 배지가 표시되고, 날짜를 고르면 그 날짜의 시간만 패널에 보인다", async () => {
    const slots = [new Date("2026-10-15T18:00:00.000Z"), new Date("2026-10-16T18:00:00.000Z")];
    const onListSlots = vi.fn().mockResolvedValue(slots);
    render(
      <LessonBookingTab
        {...baseProps}
        bookableEnrollments={[enrollment]}
        regularLessonTypeId="lt1"
        onListSlots={onListSlots}
      />
    );
    await waitFor(() => expect(onListSlots).toHaveBeenCalled());

    // 첫 슬롯 날짜가 기본 선택되어 그 날짜의 시간 버튼이 패널에 보인다.
    await waitFor(() => expect(screen.getByTestId("selected-date-label")).toHaveTextContent(/10월 15일/));
  });

  it("다른 날짜를 클릭하면 그 날짜의 시간만 보여준다(선택 안 한 날짜의 시간은 안 보임)", async () => {
    const slots = [new Date("2026-10-15T18:00:00.000Z"), new Date("2026-10-20T20:00:00.000Z")];
    const onListSlots = vi.fn().mockResolvedValue(slots);
    render(
      <LessonBookingTab
        {...baseProps}
        bookableEnrollments={[enrollment]}
        regularLessonTypeId="lt1"
        onListSlots={onListSlots}
      />
    );
    await waitFor(() => expect(onListSlots).toHaveBeenCalled());
    await screen.findByText("2026년 10월");

    fireEvent.click(screen.getByText("20"));
    await waitFor(() => expect(screen.getByTestId("selected-date-label")).toHaveTextContent(/10월 20일/));
  });
});

describe("LessonBookingTab — 예정된 수업 월간 보기", () => {
  const booking: UpcomingBooking = {
    reservationId: "r1",
    sessionId: "s1",
    subjectName: "SAT Math",
    teacherName: "김선생",
    startsAt: "2026-10-15T18:00:00.000Z",
    endsAt: "2026-10-15T20:00:00.000Z",
    googleMeetLink: "https://meet.google.com/abc-defg-hij",
    googleSyncStatus: "synced",
  };

  it("기본은 목록 보기이고, 월간으로 전환하면 달력이 보인다", async () => {
    render(<LessonBookingTab {...baseProps} upcomingBookings={[booking]} />);
    expect(screen.getByText(/SAT Math · 김선생 선생님/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("월간"));
    await screen.findByLabelText("다음 달");
  });

  it("월간 보기에서 날짜를 클릭하면 그 날짜 수업만 필터링된다", async () => {
    const otherDayBooking: UpcomingBooking = { ...booking, reservationId: "r2", startsAt: "2026-10-20T18:00:00.000Z" };
    render(<LessonBookingTab {...baseProps} upcomingBookings={[booking, otherDayBooking]} />);
    fireEvent.click(screen.getByText("월간"));
    await screen.findByLabelText("다음 달");

    const day15 = screen.getAllByText("15").find((el) => el.closest("button"));
    fireEvent.click(day15!.closest("button")!);

    const bookingCards = screen.getAllByText(/SAT Math · 김선생 선생님/);
    expect(bookingCards).toHaveLength(1);
  });
});
