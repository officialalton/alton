import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminShell from "./AdminShell";
import type { AdminDashboardData } from "./dashboard-data";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateDocTitle: vi.fn(),
  setDocPublished: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
  generateSectionProblems: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
}));

// P2/P3(2026-09-12) — CatalogTab이 과목 목록을 스스로 불러온다(첫 진입에
// 목록이 안 보이던 결함 수정). 이 스펙은 탭 렌더링만 보므로 로더는 대역으로 둔다.
vi.mock("./subject-actions", () => ({
  listSubjectCatalogAction: vi.fn(async () => []),
  createSubject: vi.fn(),
  renameSubject: vi.fn(),
  deleteSubject: vi.fn(),
  addSubjectUnit: vi.fn(),
  updateSubjectUnit: vi.fn(),
  removeSubjectUnit: vi.fn(),
  createSubjectKeyword: vi.fn(),
  assignUnitKeyword: vi.fn(),
  removeUnitKeyword: vi.fn(),
  moveSubjectUnit: vi.fn(),
  archiveSubject: vi.fn(),
  restoreSubject: vi.fn(),
}));

vi.mock("./users-actions", () => ({
  inviteParent: vi.fn(),
  inviteStudent: vi.fn(),
  inviteTeacher: vi.fn(),
  setStudentStatus: vi.fn(),
  setTeacherStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
  listParentsForUsersTabAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  listStudentsForUsersTabAction: vi.fn().mockResolvedValue({ students: [], creditHistoryByStudent: {} }),
  listTeachersForUsersTabAction: vi.fn().mockResolvedValue({ teachers: [], qcWarningsByTeacher: {} }),
}));

vi.mock("./teacher-subjects-actions", () => ({
  assignTeacherSubject: vi.fn(),
  unassignTeacherSubject: vi.fn(),
}));

vi.mock("./consultation-actions", () => ({
  createConsultation: vi.fn(),
  scheduleConsultation: vi.fn(),
  rescheduleConsultation: vi.fn(),
  cancelConsultation: vi.fn(),
  markConsultationNoShow: vi.fn(),
  findDuplicateConsultationCandidates: vi.fn(),
  createClassificationTag: vi.fn(),
  listClassificationTags: vi.fn(),
  tagConsultation: vi.fn(),
  untagConsultation: vi.fn(),
  createTrialSessionFromConsultation: vi.fn(),
  completeTrialSession: vi.fn(),
  approveTrialException: vi.fn(),
  cancelTrialSession: vi.fn(),
  markTrialNoShow: vi.fn(),
  createProposal: vi.fn(),
  sendProposal: vi.fn(),
  respondToProposal: vi.fn(),
  retryFailedDriveArtifacts: vi.fn(),
  reconcileDocusignStatus: vi.fn(),
  createContractFromProposal: vi.fn(),
  companySignOffContractVersion: vi.fn(),
  sendContractForSignature: vi.fn(),
  createNewContractVersionForResend: vi.fn(),
  voidContractVersion: vi.fn(),
}));

vi.mock("./entitlement-actions", () => ({
  createEntitlementProductVersion: vi.fn(),
  discontinueEntitlementProductVersion: vi.fn(),
  approveRefund: vi.fn(),
  rejectRefund: vi.fn(),
  extendEntitlementForCompanyOrTeacherCancellation: vi.fn(),
  transferEntitlementBetweenChildren: vi.fn(),
  adminLookupPurchaseDetail: vi.fn(),
}));

const dashboard: AdminDashboardData = {
  adminName: "관리자",
  pendingConsults: [],
  upcomingConsults: [],
  pendingStudents: [],
  pendingTeachers: [],
  qcWarnings: [],
};

const baseProps = {
  adminUserId: "admin1",
  dashboard,
  subjects: [],
  docs: [],
  parents: [],
  students: [],
  matchingStudents: [],
  creditHistoryByStudent: {},
  initialUnifiedScheduleMonthAnchor: "2026-09",
  consultations: [],
  trials: [],
  proposals: [],
  consentGaps: [],
  completedConsents: [],
  driveIssues: [],
  staleEnvelopes: [],
  contractActivationRetries: [],
  devLogContent: "## Phase 1\n- [x] 완료된 항목\n- [ ] 남은 항목\n",
  payoutBatches: [],
  teacherCandidatesBySubject: {},
  workspaceProvisionings: [],
  entitlementProducts: [],
  entitlementProductVersions: [],
  openPriceChangeNotices: [],
  pendingRefundRequests: [],
  purchasesNeedingReconciliation: [],
  openOrRecentPaymentDisputes: [],
};

describe("AdminShell", () => {
  it("사이드바 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(<AdminShell {...baseProps} />);
    [
      "Home",
      "Users",
      "Matching",
      "Onboarding",
      "Curriculum",
      "Legacy Credits",
      "Entitlements",
      "Schedule",
      "Payouts",
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.getByText("관리자, 안녕하세요")).toBeInTheDocument();
  });

  it("2026-09-10(P0-3 2차) — 브라우저 뒤로가기/앞으로가기로 initialTab prop이 바뀌면 activeTab이 그대로 따라간다(마운트 시점에만 반영되던 정체 상태 수정)", async () => {
    const { rerender } = render(<AdminShell {...baseProps} initialTab="entitlements" />);
    expect(await screen.findByRole("heading", { name: "Entitlements" })).toBeInTheDocument();

    // Next.js가 뒤로가기로 새 initialTab을 다시 내려주는 상황을 재현한다 —
    // AdminShell 컴포넌트 자체는 리마운트되지 않고 새 props만 받는다.
    rerender(<AdminShell {...baseProps} initialTab="catalog" />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "과목 템플릿" })).toBeInTheDocument()
    );
    expect(screen.queryByRole("heading", { name: "Entitlements" })).not.toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): '개발 로그'는 일반 네비게이션(사이드바)에 노출되지 않는다", () => {
    render(<AdminShell {...baseProps} />);
    expect(screen.queryByText("개발 로그")).not.toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): 모바일 '운영' 드로어를 열어도 '개발 로그'가 보이지 않는다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByLabelText("메뉴 열기"));
    expect(screen.getByText("운영")).toBeInTheDocument();
    expect(screen.queryByText("개발 로그")).not.toBeInTheDocument();
  });

  it("사용자 탭을 누르면 UsersTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Users"));
    expect(screen.getByText("학부모")).toBeInTheDocument();
  });

  it("매칭 탭을 누르면 MatchingTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Matching"));
    expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 홈으로/로그아웃 버튼이 보인다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("관리자 ▾"));
    expect(screen.getByText("홈으로")).toBeInTheDocument();
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });

  it("다른 탭에서 홈으로를 누르면 대시보드로 돌아온다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Matching"));
    fireEvent.click(screen.getByText("관리자 ▾"));
    fireEvent.click(screen.getByText("홈으로"));
    expect(screen.getByText("관리자, 안녕하세요")).toBeInTheDocument();
  });

  it("커리큘럼 탭을 누르면 과목 템플릿 서브탭이 렌더링된다", async () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Curriculum"));
    // 목록은 화면이 직접 불러온다 — 도착한 뒤에 보인다.
    expect(await screen.findByText("+ 과목 추가")).toBeInTheDocument();
  });

  it("구 크레딧(레거시) 탭을 누르면 BillingTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Legacy Credits"));
    expect(screen.getByText("학생별 수업권 현황")).toBeInTheDocument();
  });

  it("수업권 탭을 누르면 EntitlementLedgerTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Entitlements"));
    expect(screen.getByRole("heading", { name: "Entitlements" })).toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): 내비게이션엔 없지만 ?tab=devlog 직접 접근으로는 DevLogTab이 그대로 열린다(내부 전용 경로)", () => {
    render(<AdminShell {...baseProps} initialTab="devlog" />);
    expect(screen.getByText("완료된 항목")).toBeInTheDocument();
    expect(screen.getByText("남은 항목")).toBeInTheDocument();
  });

  it("정산 탭을 누르면 PayoutBatchesTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Payouts"));
    expect(screen.getByRole("heading", { name: "Payouts" })).toBeInTheDocument();
    // P4-2(2026-09-12): 정상 경로가 자동 마감으로 바뀌면서 기본 버튼이
    // "월 마감 실행"이 됐다(기존 "Batch 생성"은 구경로로 남겨 이름이 바뀜).
    // 설명 문단에도 같은 문구가 나오므로 버튼으로 한정한다.
    expect(screen.getByRole("button", { name: "월 마감 실행" })).toBeInTheDocument();
  });

  // 2026-09-19 — 관리자 포털의 모의고사는 다른 포털과 달리 AdminTabId에
  // 포함된 일반 셸 탭이다(admin-tabs.ts ADMIN_NAV_TAB_IDS 참고) — 독립
  // 라우트로 이동하지 않고 다른 탭과 같은 방식(?tab=mock-exam)으로 전환된다.
  it("사이드바 '모의고사'를 누르면 모의고사 탭으로 전환된다", () => {
    pushMock.mockClear();
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("Mock Exams"));
    expect(pushMock).toHaveBeenCalledWith("?tab=mock-exam", { scroll: false });
  });
});
