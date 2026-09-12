import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClassesTab from "./ClassesTab";
import type { LessonItem } from "./lessons-data";
import type { UpcomingBooking, PastSessionForReport } from "./lesson-booking-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const upcomingLesson: LessonItem = {
  sessionId: "legacy-1",
  enrollmentId: "e1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  teacherName: "박서연",
  sessionNumber: 8,
  unitTitle: "이차방정식",
  status: "upcoming",
  scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  durationMinutes: 30,
};

const pastLesson: LessonItem = {
  ...upcomingLesson,
  sessionId: "legacy-2",
  sessionNumber: 7,
  status: "completed",
  scheduledAt: "2026-08-01T05:00:00.000Z",
};

const upcomingBooking: UpcomingBooking = {
  reservationId: "r1",
  sessionId: "v3-1",
  subjectName: "SAT Math",
  teacherName: "김선생",
  startsAt: new Date(Date.now() + 3600_000).toISOString(),
  endsAt: new Date(Date.now() + 7200_000).toISOString(),
  googleMeetLink: null,
  googleSyncStatus: "synced",
};

const pastSession: PastSessionForReport = {
  sessionId: "v3-2",
  subjectName: "SAT Math",
  teacherName: "김선생",
  startsAt: "2026-08-25T05:00:00.000Z",
  needsReview: false,
};

const baseProps = {
  upcoming: [upcomingLesson],
  past: [pastLesson],
  curricula: [],
  memosByEnrollment: {},
  reviews: {},
  myFeedback: {},
  bookableEnrollments: [],
  upcomingBookings: [upcomingBooking],
  pastSessionsForReport: [pastSession],
  timezone: "America/Los_Angeles",
  onListSlots: vi.fn().mockResolvedValue([]),
  onCreateBooking: vi.fn(),
  onCreateWeeklySeries: vi.fn(),
  onCancelBooking: vi.fn(),
  onReportTeacherIssue: vi.fn().mockResolvedValue(undefined),
};

describe("ClassesTab — '레슨'+'예약' 병합, 예정/지난 서브탭 버그 재현·수정", () => {
  it("딱 두 개의 서브탭('예정 수업'/'지난 수업')만 있고, 기본은 예정 수업이 보인다", () => {
    render(<ClassesTab {...baseProps} />);
    expect(screen.getByText("예정 수업")).toBeInTheDocument();
    expect(screen.getByText("지난 수업")).toBeInTheDocument();
    expect(screen.getByText(/SAT Math · 김선생 선생님/)).toBeInTheDocument();
  });

  it("'지난 수업' 서브탭을 누르면 실제로 내용이 지난 수업으로 바뀐다(서브탭 전환 버그 재현·수정 고정)", () => {
    render(<ClassesTab {...baseProps} />);
    // 전환 전: 예정 수업(v3)만 보이고 지난 수업 목록은 없다.
    expect(screen.getByText(/SAT Math · 김선생 선생님/)).toBeInTheDocument();
    expect(screen.queryByText("최근 14일 이내 지난 수업이 없습니다.")).toBeNull();

    fireEvent.click(screen.getByText("지난 수업"));

    // 전환 후: 지난 수업(v3) 카드가 보이고, 예정 수업 예약 생성 폼은 사라진다.
    expect(screen.getByText("수업 준비 내역")).toBeInTheDocument();
    expect(screen.queryByText("수업 예약")).toBeNull();

    // 레거시 커리큘럼 기록 서브섹션도 같은 서브탭(지난 수업)에 동기화된다.
    fireEvent.click(screen.getByText("커리큘럼 진행·리뷰 (레거시 수업 기록)"));
    expect(screen.getByText(/7회차/)).toBeInTheDocument();
    expect(screen.queryByText(/8회차/)).toBeNull();
  });

  it("'예정 수업'으로 되돌아가면 레거시 서브섹션도 다시 예정 목록으로 동기화된다", () => {
    render(<ClassesTab {...baseProps} />);
    fireEvent.click(screen.getByText("지난 수업"));
    fireEvent.click(screen.getByText("예정 수업"));
    fireEvent.click(screen.getByText("커리큘럼 진행·리뷰 (레거시 수업 기록)"));
    expect(screen.getByText(/8회차/)).toBeInTheDocument();
    expect(screen.queryByText(/7회차/)).toBeNull();
  });
});
