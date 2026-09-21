import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParentShell from "./ParentShell";
import type { DashboardData } from "@/app/student/dashboard-data";
import type { Child } from "./children-data";

const pushMock = vi.fn();
vi.mock("./mock-exam-tab-actions", () => ({
  loadChildMockExamAttemptsAction: vi.fn(async () => []),
}));
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
  listOpenGuardianMeetingSlots: vi.fn().mockResolvedValue([]),
}));

vi.mock("./home-reviews-actions", () => ({
  getAllFamilyLessonReviews: vi.fn().mockResolvedValue([]),
  getHomeConsultationReviews: vi.fn().mockResolvedValue([]),
}));

vi.mock("./home-stats-actions", () => ({
  getParentChildStats: vi.fn().mockResolvedValue({ attendanceRate: null, satisfactionAvg: null, bySubject: [] }),
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
  it("사이드바 항목(홈/수업권/수강 과목/수업/상담/단어장/과제)을 보여주고, 기본 탭은 홈(종합 리뷰 서브탭 = 월간 종합 리뷰 자리)이다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    ["Home", "Credits", "My Courses", "Classes", "Consultations", "Vocabulary", "Assignments"].forEach((label) =>
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    );
    // 2026-09-17/18 IA 재구성: 지인 추천/통계(독립 탭)/동의/가족/예약/교재는
    // 메인 내비게이션에서 제거됐다(지인 추천·동의는 프로필 드롭다운, 통계는
    // 홈 서브탭으로 이동).
    expect(screen.queryByText("지인 추천")).not.toBeInTheDocument();
    expect(screen.queryByText("가족")).not.toBeInTheDocument();
    expect(screen.queryByText("예약")).not.toBeInTheDocument();
    expect(screen.queryByText("교재")).not.toBeInTheDocument();
    expect(screen.getAllByText("지훈").length).toBeGreaterThan(0);
    expect(screen.getAllByText("이서아").length).toBeGreaterThan(0);
    expect(screen.getByText("종합 리뷰")).toBeInTheDocument();
    expect(screen.getByText("수업 리뷰")).toBeInTheDocument();
    expect(screen.getByText("상담 리뷰")).toBeInTheDocument();
    // "통계"는 이제 홈 서브탭 라벨로만 존재한다.
    expect(screen.getAllByText("통계").length).toBeGreaterThan(0);
    // 2026-09-18(사용자 결정 2차) — "종합 리뷰"는 수업/상담 리뷰를 합친 목록이
    // 아니라 향후 AI OS가 만들 "월간 종합 리뷰" 전용 자리라 정적 준비 중
    // 문구만 보여준다(데이터 로딩 없음 — 즉시 렌더되므로 findByText 불필요).
    expect(screen.getByText("월간 종합 리뷰")).toBeInTheDocument();
    expect(screen.getByText(/아직 생성된 월간 종합 리뷰가 없습니다/)).toBeInTheDocument();
  });

  it("홈 '종합 리뷰' 서브탭은 수업/상담 리뷰 로더를 호출하지 않는다(합산 목록 아님)", async () => {
    const { getAllFamilyLessonReviews } = await import("./home-reviews-actions");
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    expect(getAllFamilyLessonReviews).not.toHaveBeenCalled();
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

  it("홈 '수업 리뷰' 서브탭을 누르면 확정된 수업 리뷰+미팅록만 시간순으로 보여준다(종합 리뷰와 별개 로딩)", async () => {
    const { getAllFamilyLessonReviews } = await import("./home-reviews-actions");
    vi.mocked(getAllFamilyLessonReviews).mockResolvedValueOnce([
      {
        reviewId: "rev1",
        sessionId: "sess1",
        lessonType: "regular",
        finalText: "수업 리뷰 내용",
        aiSummary: null,
        finalizedAt: "2026-09-10T00:00:00.000Z",
        categoryNotes: [],
        meetingRecordLink: "https://drive.google.com/file/d/f1/view",
      },
    ]);
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    expect(getAllFamilyLessonReviews).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("수업 리뷰"));
    expect(await screen.findByText("수업 리뷰 내용")).toBeInTheDocument();
    expect(getAllFamilyLessonReviews).toHaveBeenCalledTimes(1);
  });

  it("홈 '통계' 서브탭을 누르면 StatsTab(읽기 전용)이 렌더링된다", async () => {
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
    expect(await screen.findByText("수업 참여율")).toBeInTheDocument();
  });

  it("홈 '상담 리뷰' 서브탭은 종합 리뷰와 분리되어 household 상담 리뷰만 보여준다(빈 상태 포함)", async () => {
    const { getHomeConsultationReviews } = await import("./home-reviews-actions");
    vi.mocked(getHomeConsultationReviews).mockResolvedValueOnce([
      {
        meetingRequestId: "mr1",
        startsAt: "2026-09-10T05:00:00.000Z",
        endsAt: "2026-09-10T05:30:00.000Z",
        finalText: "학습 태도가 좋아졌습니다.",
        finalizedAt: "2026-09-11T00:00:00.000Z",
        meetingRecordLink: null,
      },
    ]);
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("상담 리뷰"));
    expect(await screen.findByText("학습 태도가 좋아졌습니다.")).toBeInTheDocument();
    expect(screen.getByText("미팅록이 없습니다.")).toBeInTheDocument();
  });

  it("홈 '상담 리뷰' 서브탭 빈 상태는 간결한 문구를 보여준다", async () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("상담 리뷰"));
    expect(await screen.findByText("아직 확정된 상담 리뷰가 없습니다.")).toBeInTheDocument();
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

  it("수업 탭을 누르면 읽기전용 LessonsTab이 렌더링된다(메모 입력창 없음)", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("Classes")[0]);
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  // 2026-09-19(UAT 반영, 제품 오너 결정) — 2026-09-17 R13의 "예약 독립 탭
  // 제거" 정책을 되돌려 "Bookings" 탭을 다시 만들었다. LessonBookingTab
  // 자체 동작은 그 컴포넌트 테스트가 이미 커버하므로, 여기서는 탭 진입만 확인.
  it("Bookings 탭을 누르면 LessonBookingTab이 렌더링된다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("Bookings")[0]);
    expect(
      screen.getByText(/아직 선생님 배정이 완료되지 않았어요/)
    ).toBeInTheDocument();
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
    fireEvent.click(screen.getAllByText("Credits")[0]);
    expect(screen.getByText("현황")).toBeInTheDocument();
    expect(screen.getByText("구매")).toBeInTheDocument();
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
    fireEvent.click(screen.getAllByText("Consultations")[0]);
    expect(screen.getByPlaceholderText("상담 사유를 입력해주세요")).toBeInTheDocument();
    fireEvent.click(screen.getByText("상담 내역"));
    expect(await screen.findByText("신청한 상담이 없습니다.")).toBeInTheDocument();
  });

  // 2026-09-18 통합 지시: 신규 자녀 상담 신청 흐름(showNewChildConsult 토글,
  // ConsultRequestTab)은 완전히 폐기됐다 — "상담 신청" 서브탭은 이제
  // ConsultationRequestTab 단일 흐름으로만 연결된다.

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
    expect(screen.getAllByText("동의").length).toBeGreaterThan(0);
    expect(screen.getAllByText("지인 추천").length).toBeGreaterThan(0);
    expect(screen.getAllByText("시간대 설정").length).toBeGreaterThan(0);
    expect(screen.getAllByText("로그아웃").length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getAllByText("지인 추천")[0]);
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
    fireEvent.click(screen.getAllByText("동의")[0]);
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
    expect(within(screen.getAllByText("동의")[0].parentElement as HTMLElement).getByText("1")).toBeInTheDocument();
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
    expect(within(screen.getAllByText("동의")[0].parentElement as HTMLElement).queryByText("1")).not.toBeInTheDocument();
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
    expect(within(screen.getAllByText("동의")[0].parentElement as HTMLElement).getByText("1")).toBeInTheDocument();
  });

  // 2026-09-21(UAT 지적) — 홈 탭의 "모의고사" 서브탭은 독립 라우트로 이동하지 않고
  // 탭 안에서 현재 선택된 자녀의 응시 목록을 바로 보여준다(좌측 네비 유지).
  it("홈 탭의 '모의고사' 서브탭을 누르면 라우트 이동 없이 탭 안에서 자녀 응시 목록을 보여준다", async () => {
    pushMock.mockClear();
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("모의고사"));
    expect(pushMock).not.toHaveBeenCalledWith("/parent/mock-exam/s1");
    expect(await screen.findByText("배정된 모의고사가 없습니다.")).toBeInTheDocument();
  });

  it("현재 활성 탭에는 aria-current가 붙고, 탭 전환 시 이동한다", () => {
    render(
      <ParentShell
        parentName="김민지"
        childrenList={childrenList}
        currentChildId="s1"
        dashboard={dashboard}
        {...lessonsProps}
      />
    );
    expect(screen.getAllByRole("button", { name: new RegExp("Home") })[0]).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getAllByRole("button", { name: new RegExp("Credits") })[0]
    ).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getAllByRole("button", { name: new RegExp("Credits") })[0]);
    expect(screen.getAllByRole("button", { name: new RegExp("Credits") })[0]).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getAllByRole("button", { name: new RegExp("Home") })[0]
    ).not.toHaveAttribute("aria-current");
  });
});
