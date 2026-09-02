import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParentShell from "./ParentShell";
import type { DashboardData } from "@/app/student/dashboard-data";
import type { Child } from "./children-data";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("@/app/student/memo-actions", () => ({
  addMemo: vi.fn(),
}));

vi.mock("@/app/student/review-actions", () => ({
  submitStudentFeedback: vi.fn(),
}));

vi.mock("./credits-actions", () => ({
  createCreditCheckoutSession: vi.fn(),
}));

vi.mock("./purchase-actions", () => ({
  createEntitlementCheckoutSession: vi.fn(),
}));

const childrenList: Child[] = [
  { studentId: "s1", name: "지훈", isPrimary: true },
  { studentId: "s2", name: "이서아", isPrimary: false },
];

const dashboard: DashboardData = {
  studentName: "지훈",
  upcoming: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
  attendanceRate: null,
};

const lessonsProps = {
  upcoming: [],
  past: [],
  curricula: [],
  memosByEnrollment: {},
  reviews: {},
  myFeedback: {},
  bookableEnrollments: [],
  credits: { balance: 0, referralCode: null, packages: [] },
  entitlements: { prices: [], children: [] },
  consentChildren: [],
  activeConsentPolicy: null,
  childrenSubjectEnrollments: [],
  lessonBooking: {
    bookableEnrollments: [],
    upcomingBookings: [],
    regularLessonTypeId: null,
    lessonDurationMinutes: 120,
    timezone: "America/Los_Angeles",
  },
};

describe("ParentShell", () => {
  it("사이드바 항목과 자녀 전환 pill을 보여주고, 기본 탭은 홈이다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    ["홈", "레슨", "수업권", "통계"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.getByText("이서아")).toBeInTheDocument();
    expect(screen.getByText(/지훈의 학습 현황/)).toBeInTheDocument();
  });

  it("다른 자녀 pill을 누르면 ?child= 쿼리로 이동한다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("이서아"));
    expect(replaceMock).toHaveBeenCalledWith("?child=s2&tab=home", { scroll: false });
  });

  it("레슨 탭을 누르면 읽기전용 LessonsTab이 렌더링된다(메모 입력창 없음)", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("레슨"));
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("수업권 탭을 누르면 CreditsTab이 렌더링되고 결제수단 입력은 없다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("수업권"));
    expect(screen.getByText("장 보유")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0000 0000 0000 0000")).not.toBeInTheDocument();
  });

  it("다른 탭을 누르면 준비 중 문구를 보여준다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("통계"));
    expect(screen.getByText("통계 탭은 준비 중입니다.")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 로그아웃 버튼이 보인다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("김민지 학부모님 ▾"));
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });
});
