import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LessonBookingTab from "./LessonBookingTab";
import type { PastSessionForReport, UpcomingBooking, BookableSubjectEnrollment } from "./lesson-booking-data";

const refreshMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}));

const pastSession: PastSessionForReport = {
  sessionId: "s1",
  subjectName: "SAT Math",
  teacherName: "김선생",
  startsAt: "2026-08-25T05:00:00.000Z",
  needsReview: false,
};

const baseProps = {
  bookableEnrollments: [],
  upcomingBookings: [],
  pastSessionsForReport: [],
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
    expect(screen.getByText("최근 14일 이내 지난 수업이 없습니다.")).toBeInTheDocument();
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
  lessonTypeId: "lt1",
  lessonDurationMinutes: 120,
  isTrial: false,
};

describe("LessonBookingTab — 월간 캘린더 예약", () => {
  it("슬롯이 로드되면 달력에 배지가 표시되고, 날짜를 고르면 그 날짜의 시간만 패널에 보인다", async () => {
    const slots = [new Date("2026-10-15T18:00:00.000Z"), new Date("2026-10-16T18:00:00.000Z")];
    const onListSlots = vi.fn().mockResolvedValue(slots);
    render(
      <LessonBookingTab
        {...baseProps}
        bookableEnrollments={[enrollment]}
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

const trialEnrollment: BookableSubjectEnrollment = {
  subjectEnrollmentId: "e2",
  subjectName: "AP Calculus AB",
  teacherId: "t2",
  teacherName: "장선생",
  lessonTypeId: "lt-trial",
  lessonDurationMinutes: 60,
  isTrial: true,
};

describe("LessonBookingTab — 체험 학생도 직접 예약할 수 있어야 한다", () => {
  it("체험 과목을 고르면 주 1회 반복 토글이 사라지고 1회만 예약할 수 있다는 안내가 보인다", async () => {
    render(
      <LessonBookingTab {...baseProps} bookableEnrollments={[trialEnrollment]} onListSlots={vi.fn().mockResolvedValue([])} />
    );
    expect(screen.queryByText("주 1회 반복(최대 8회)")).not.toBeInTheDocument();
    expect(screen.getByText("체험 수업은 1회만 예약할 수 있습니다.")).toBeInTheDocument();
  });

  it("체험 과목의 예약은 체험 수업권(lessonTypeId)과 60분으로 onCreateBooking을 호출한다", async () => {
    const slots = [new Date("2026-10-15T18:00:00.000Z")];
    const onCreateBooking = vi.fn().mockResolvedValue({ ok: true, data: { reservationId: "r1", sessionId: "s1" } });
    render(
      <LessonBookingTab
        {...baseProps}
        bookableEnrollments={[trialEnrollment]}
        onListSlots={vi.fn().mockResolvedValue(slots)}
        onCreateBooking={onCreateBooking}
      />
    );
    await waitFor(() => expect(screen.getByTestId("selected-date-label")).toHaveTextContent(/10월 15일/));

    fireEvent.click(screen.getAllByText(/오후|오전/)[0]);
    fireEvent.click(screen.getByText("최종 확정"));

    await waitFor(() =>
      expect(onCreateBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectEnrollmentId: "e2",
          teacherId: "t2",
          lessonTypeId: "lt-trial",
          durationMinutes: 60,
        })
      )
    );
  });
});

describe("LessonBookingTab — 예약 폼 레이아웃 정리(2026-09-06)", () => {
  it("예정 수업이 이미 있으면 예약 폼이 기본 접히고 '+ 새 수업 예약하기' 토글만 보인다", () => {
    const upcomingBooking: UpcomingBooking = {
      reservationId: "r1",
      sessionId: "sess-1",
      subjectName: "SAT Math",
      teacherName: "김선생",
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      googleMeetLink: null,
      googleSyncStatus: "synced",
    };
    render(<LessonBookingTab {...baseProps} bookableEnrollments={[enrollment]} upcomingBookings={[upcomingBooking]} />);
    expect(screen.getByText("+ 새 수업 예약하기")).toBeInTheDocument();
    expect(screen.queryByText("과목·선생님 선택")).not.toBeInTheDocument();
    expect(screen.queryByText("예약 가능 시간을 불러오는 중…")).not.toBeInTheDocument();
  });

  it("이미 체험 수업을 예약한 학생은 폼 대신 '이미 체험 수업을 예약하셨습니다' 안내를 본다(슬롯 재조회 안 함)", async () => {
    const trialBooking: UpcomingBooking = {
      reservationId: "r2",
      sessionId: "sess-2",
      subjectEnrollmentId: trialEnrollment.subjectEnrollmentId,
      subjectName: trialEnrollment.subjectName,
      teacherName: trialEnrollment.teacherName,
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      googleMeetLink: null,
      googleSyncStatus: "synced",
    };
    const onListSlots = vi.fn().mockResolvedValue([]);
    render(
      <LessonBookingTab
        {...baseProps}
        bookableEnrollments={[trialEnrollment]}
        upcomingBookings={[trialBooking]}
        onListSlots={onListSlots}
      />
    );
    // 예정 수업이 이미 있으므로 폼은 기본 접힘 — 펼쳐서 안내 문구를 확인한다.
    fireEvent.click(screen.getByText("+ 새 수업 예약하기"));
    expect(screen.getByText(/이미 체험 수업을 예약하셨습니다/)).toBeInTheDocument();
    expect(screen.queryByText("예약 가능 시간을 불러오는 중…")).not.toBeInTheDocument();
    await waitFor(() => expect(onListSlots).not.toHaveBeenCalled());
  });

  // v3 재매칭 후 예약 결함 수정(2026-09-11, Preview UAT 지적) — 매칭 종료된
  // 옛 수강 건(다른 subjectEnrollmentId)의 예약이 같은 과목명·선생님명이라는
  // 이유만으로 재매칭된 새 수강 건의 체험 예약을 막으면 안 된다.
  it("다른(옛) 수강 건의 예약은 과목·선생님명이 같아도 새 수강 건의 체험 예약을 막지 않는다", async () => {
    const staleBookingFromOldEnrollment: UpcomingBooking = {
      reservationId: "r-old",
      sessionId: "sess-old",
      subjectEnrollmentId: "e2-old-terminated",
      subjectName: trialEnrollment.subjectName,
      teacherName: trialEnrollment.teacherName,
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      googleMeetLink: null,
      googleSyncStatus: "synced",
    };
    const onListSlots = vi.fn().mockResolvedValue([]);
    render(
      <LessonBookingTab
        {...baseProps}
        bookableEnrollments={[trialEnrollment]}
        upcomingBookings={[staleBookingFromOldEnrollment]}
        onListSlots={onListSlots}
      />
    );
    fireEvent.click(screen.getByText("+ 새 수업 예약하기"));
    expect(screen.queryByText(/이미 체험 수업을 예약하셨습니다/)).toBeNull();
    await waitFor(() => expect(onListSlots).toHaveBeenCalled());
  });
});

describe("LessonBookingTab — mode(A안 '수업' 탭 통합)", () => {
  const upcomingBooking: UpcomingBooking = {
    reservationId: "r1",
    sessionId: "sess-1",
    subjectName: "SAT Math",
    teacherName: "김선생",
    startsAt: new Date(Date.now() + 3600_000).toISOString(),
    endsAt: new Date(Date.now() + 7200_000).toISOString(),
    googleMeetLink: "https://meet.google.com/abc-defg-hij",
    googleSyncStatus: "synced",
  };

  it("mode='upcoming'이면 예정 수업 블록만 보이고 지난 수업 블록은 숨겨진다", () => {
    render(<LessonBookingTab {...baseProps} upcomingBookings={[upcomingBooking]} pastSessionsForReport={[pastSession]} mode="upcoming" />);
    expect(screen.getByText(/SAT Math · 김선생 선생님/)).toBeInTheDocument();
    expect(screen.queryByText("지난 수업")).toBeNull();
  });

  it("mode='past'이면 지난 수업 블록만 보이고 예정 수업 블록·예약 생성 폼은 숨겨진다", () => {
    render(<LessonBookingTab {...baseProps} upcomingBookings={[upcomingBooking]} pastSessionsForReport={[pastSession]} mode="past" />);
    expect(screen.getByText("지난 수업")).toBeInTheDocument();
    expect(screen.queryByText("수업 준비")).toBeNull();
    expect(screen.queryByText("수업 예약")).toBeNull();
  });

  it("예정 수업 카드에 '수업 준비'(세션뷰 이동)와 '수업 시작'(Meet 새 탭 + 세션뷰 이동) 버튼이 보인다", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    pushMock.mockClear();
    render(<LessonBookingTab {...baseProps} upcomingBookings={[upcomingBooking]} mode="upcoming" />);

    fireEvent.click(screen.getByText("수업 준비"));
    expect(pushMock).toHaveBeenCalledWith(`/session/${upcomingBooking.sessionId}`);
    fireEvent.click(screen.getByText("수업 시작"));
    // 2026-09-09(제품 오너 지시): 빈 탭을 연 뒤 location.href를 나중에 설정하는
    // 패턴은 완전히 제거됐다("noopener"가 있으면 window.open()이 null을 반환해
    // location.href 대입이 항상 스킵되는 버그가 있었다) — 실제 Meet URL이
    // window.open()에 직접 전달되는지 검증한다.
    expect(openSpy).toHaveBeenCalledWith(upcomingBooking.googleMeetLink, "_blank", "noopener,noreferrer");
    // 2026-09-09(UAT 지적): "수업 시작"도 Meet 새 탭뿐 아니라 현재 탭을 세션뷰로 이동해야 한다.
    expect(pushMock).toHaveBeenCalledWith(`/session/${upcomingBooking.sessionId}`);
    openSpy.mockRestore();
  });

  it("지난 수업 카드에 '수업 준비 내역' 링크가 보인다", () => {
    render(<LessonBookingTab {...baseProps} pastSessionsForReport={[pastSession]} mode="past" />);
    expect(screen.getByText("수업 준비 내역")).toBeInTheDocument();
  });
});
