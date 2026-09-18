import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParentShell from "./ParentShell";
import type { DashboardData } from "@/app/student/dashboard-data";
import type { Child } from "./children-data";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
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

vi.mock("./inquiry-actions", () => ({
  getMessengerUnreadCount: vi.fn().mockResolvedValue(0),
  listGuardianMeetingRequests: vi.fn().mockResolvedValue([]),
  submitMeetingRequest: vi.fn(),
  getGuardianMeetingRequestReview: vi.fn().mockResolvedValue(null),
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
  credits: { referralCode: null },
  entitlements: { prices: [], children: [] },
  consentChildren: [],
  activeConsentPolicy: null,
  trialSmartNotesChildren: [],
  pendingRegularIntentChoices: [],
  childrenSubjectEnrollments: [],
  vocabData: { children: [], books: [] },
  homeworkByChild: [],
  progressedTrialEnrollmentIds: [],
  lessonBooking: {
    bookableEnrollments: [],
    upcomingBookings: [],
    pastSessionsForReport: [],
    regularLessonTypeId: null,
    lessonDurationMinutes: 120,
    timezone: "America/Los_Angeles",
  },
};

describe("ParentShell", () => {
  it("사이드바 항목(홈/수업권/수강 과목/수업/상담/단어장/과제)을 보여주고, 기본 탭은 홈이다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    ["홈", "수업권", "수강 과목", "수업", "상담", "단어장", "과제"].forEach((label) =>
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    );
    // 2026-09-17 IA 재구성: 지인 추천/통계/동의/가족/예약/교재는 메인
    // 내비게이션에서 제거됐다(지인 추천·동의는 프로필 드롭다운으로 이동).
    expect(screen.queryByText("지인 추천")).not.toBeInTheDocument();
    expect(screen.queryByText("통계")).not.toBeInTheDocument();
    expect(screen.queryByText("가족")).not.toBeInTheDocument();
    expect(screen.queryByText("예약")).not.toBeInTheDocument();
    expect(screen.queryByText("교재")).not.toBeInTheDocument();
    expect(screen.getAllByText("지훈").length).toBeGreaterThan(0);
    expect(screen.getAllByText("이서아").length).toBeGreaterThan(0);
    expect(screen.getByText(/지훈의 학습 현황/)).toBeInTheDocument();
  });

  it("홈 상단에는 동의 배너를 보여주지 않는다(2026-09-17, 배지는 프로필 메뉴로만)", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
        consentChildren={[
          { studentId: "s1", name: "지훈", isUnder13: true, dobKnown: true, hasValidConsent: false, latestConsent: null },
        ]}
        trialSmartNotesChildren={[{ studentId: "s1", name: "지훈", hasConsented: false }]}
      />
    );
    expect(screen.queryByText(/동의 필요한 문서가/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getAllByText("이서아")[0]);
    expect(pushMock).toHaveBeenCalledWith("?child=s2&tab=home", { scroll: false });
  });

  it("수업 탭을 누르면 읽기전용 LessonsTab이 렌더링되고(메모 입력창 없음), 예정 수업 예약 진입점이 있다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("수업")[0]);
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
    // 2026-09-17 — "예약" 독립 탭 제거: 수업 탭 안에서 기존 LessonBookingTab
    // 모달로 들어가는 진입점만 확인한다(모달 내부 동작은 LessonBookingTab
    // 자체 테스트가 이미 커버).
    expect(screen.getByText("예정 수업 예약하기 →")).toBeInTheDocument();
  });

  it("수업권 탭을 누르면 EntitlementsTab(R4)이 렌더링된다", () => {
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
    expect(screen.getByText("수업권 구매/현황")).toBeInTheDocument();
  });

  it("상담 탭은 상담 신청 서브탭이 기본이고, 상담 내역 서브탭은 ConsultationHistoryTab을 보여준다", async () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("상담")[0]);
    expect(screen.getByText("새 자녀 상담이신가요? →")).toBeInTheDocument();
    fireEvent.click(screen.getByText("상담 내역"));
    expect(await screen.findByText("신청한 상담이 없습니다.")).toBeInTheDocument();
  });

  it("상담 탭 안의 '새 자녀 상담이신가요' 토글로 기존 가족 탭의 신규 자녀 상담 신청 흐름에 진입할 수 있다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("상담")[0]);
    fireEvent.click(screen.getByText("새 자녀 상담이신가요? →"));
    expect(screen.getByText("← 기존 자녀 상담으로")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 동의/지인 추천/시간대 설정/로그아웃이 보인다", () => {
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
    expect(screen.getByText("동의")).toBeInTheDocument();
    expect(screen.getByText("지인 추천")).toBeInTheDocument();
    expect(screen.getByText("시간대 설정")).toBeInTheDocument();
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });

  it("계정 메뉴의 지인 추천을 누르면 CreditsTab(추천 코드 전용)이 모달로 뜨고 결제수단 입력은 없다", () => {
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
    fireEvent.click(screen.getByText("지인 추천"));
    expect(screen.getByText("추천 코드가 아직 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("장 보유")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0000 0000 0000 0000")).not.toBeInTheDocument();
  });

  it("계정 메뉴의 동의를 누르면 동의 탭으로 이동한다(?tab=consent)", () => {
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
    fireEvent.click(screen.getByText("동의"));
    expect(pushMock).toHaveBeenCalledWith("?child=s1&tab=consent", { scroll: false });
  });

  it("동의/정규 진행 조치가 필요한 자녀가 있으면 계정 메뉴의 동의에 숫자 배지가 붙는다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
        consentChildren={[
          { studentId: "s1", name: "지훈", isUnder13: true, dobKnown: true, hasValidConsent: false, latestConsent: null },
        ]}
        trialSmartNotesChildren={[{ studentId: "s1", name: "지훈", hasConsented: false }]}
      />
    );
    fireEvent.click(screen.getByText("김민지 학부모님 ▾"));
    expect(within(screen.getByText("동의").parentElement as HTMLElement).getByText("1")).toBeInTheDocument();
  });

  it("생년월일이 아직 입력되지 않은 자녀는 is_under_13이 true여도 동의 배지 카운트에 포함하지 않는다(계정 생성 직후 회귀 방지)", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
        consentChildren={[
          { studentId: "s1", name: "지훈", isUnder13: true, dobKnown: false, hasValidConsent: false, latestConsent: null },
        ]}
      />
    );
    fireEvent.click(screen.getByText("김민지 학부모님 ▾"));
    expect(within(screen.getByText("동의").parentElement as HTMLElement).queryByText("1")).not.toBeInTheDocument();
  });

  it("조치가 필요한 항목이 전부 없으면 동의 배지를 보여주지 않는다", () => {
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
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("동명이인이어도 childId 기준으로 조치가 필요한 자녀 수만 배지에 센다(중복 카운트 방지)", () => {
    // s1과 s3는 이름이 같지만("지훈") id가 다르다. s3에게만 정규 진행 선택이
    // 필요하면 배지는 1이어야 한다(이름 매칭 시 잘못 부풀려질 수 있음).
    const duplicateNameChildren: Child[] = [
      { studentId: "s1", name: "지훈", isPrimary: true },
      { studentId: "s3", name: "지훈", isPrimary: false },
    ];
    render(
      <ParentShell
        parentName="김민지"
        childrenList={duplicateNameChildren}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
        pendingRegularIntentChoices={[
          { subjectEnrollmentId: "se1", childId: "s3", childName: "지훈", subjectName: "AP Calculus AB" },
        ]}
      />
    );
    fireEvent.click(screen.getByText("김민지 학부모님 ▾"));
    expect(within(screen.getByText("동의").parentElement as HTMLElement).getByText("1")).toBeInTheDocument();
  });
});
