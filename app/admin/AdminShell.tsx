"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileDrawerNav from "@/app/components/MobileDrawerNav";
import { linkAdminGoogleAccount } from "./google-link-actions";
import { resolveAdminTab, type AdminTabId } from "./admin-tabs";
import { setActiveAdminUser, clearAdminTabCache } from "./tab-data-cache";
import PageFrame from "@/app/components/PageFrame";
import NavIcon from "@/app/components/NavIcon";
import AdminHomeDashboard from "./AdminHomeDashboard";
import type { AdminDashboardData } from "./dashboard-data";
import CatalogTab from "./CatalogTab";
import ProblemBankTab from "./ProblemBankTab";
import MockExamTab from "./MockExamTab";
import type { MockExamSetSummary } from "./mock-exam-actions";
import UsersTab from "./UsersTab";
import BookingReconciliationPanel from "./BookingReconciliationPanel";
import UnifiedScheduleTab from "./UnifiedScheduleTab";
import ConsultationTab from "./ConsultationTab";
import type { KanbanCard } from "./consultation-kanban-actions";
import InquiryAndMeetingTab from "./InquiryAndMeetingTab";
import type { AdminInquiryThread } from "./inquiry-and-meeting-actions";
import type { UnifiedScheduleLessonRow, BookingReconciliationDashboard } from "./booking-actions";
import type {
  ConsultationListItem,
  TrialSessionListItem,
  DriveArtifactIssue,
  StaleEnvelopeContract,
} from "./consultation-data";
import type { ContractActivationRetryItem } from "./consultation-actions";
import DevLogTab from "./DevLogTab";
import PayoutBatchesTab from "./PayoutBatchesTab";
import type { PayoutBatchListItem } from "./payout-batches-data";
import MatchingTab from "./MatchingTab";
import type { MatchingTeacherCandidate, MatchingStudentItem } from "./matching-data";
import WorkspaceTab from "./WorkspaceTab";
import DocumentsTab from "./DocumentsTab";
import type { WorkspaceProvisioningItem } from "./workspace-data";
import EntitlementLedgerTab from "./EntitlementLedgerTab";
import type { EntitlementProductListItem, ProductVersionListItem } from "./entitlement-data";
import type {
  listOpenPriceChangeNotices,
  listPendingRefundRequests,
  listPurchasesNeedingReconciliation,
  listOpenOrRecentPaymentDisputes,
} from "./entitlement-actions";
import type { AdminSubject } from "./subject-data";
import type { CurriculumDocListItem } from "./curriculum-doc-data";
import AdminAccountsTab from "./AdminAccountsTab";
import type { AdminAccount } from "./admin-accounts-data";
import ConsultantAssignmentsTab from "./ConsultantAssignmentsTab";
import type { ConsultantWithStudents } from "./consultant-assignment-actions";
import type { IntakeConsultation } from "@/app/consultant/intake-data";

// 2026-09-19(UI 통일화) — 좌측 네비게이션 라벨은 전부 영어로 통일한다(Acely
// 레퍼런스). 탭 안 본문의 한국어 텍스트는 유지, 라벨만 영어로 바꾼다.
const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "users", label: "Users", icon: "users" },
  { id: "matching", label: "Matching", icon: "matching" },
  { id: "consult", label: "Onboarding", icon: "onboarding" },
  { id: "inquiry", label: "Inquiries", icon: "inquiries" },
  { id: "catalog", label: "Curriculum", icon: "curriculum" },
  { id: "problem-bank", label: "Question Bank", icon: "questionBank" },
  { id: "mock-exam", label: "Mock Exams", icon: "mockExam" },
  { id: "entitlements", label: "Entitlements", icon: "entitlements" },
  { id: "unified-schedule", label: "Schedule", icon: "schedule" },
  { id: "booking", label: "Bookings", icon: "bookings" },
  { id: "payouts", label: "Payouts", icon: "payouts" },
  { id: "documents", label: "Documents", icon: "documents" },
  { id: "workspace", label: "Workspace", icon: "workspace" },
  // 2026-09-22(관리자 계정 구조) — 마스터가 아니면 렌더링 시점에 걸러낸다
  // (아래 visibleNavItems 참고). NAV_ITEMS 자체엔 늘 들어 있다 — ALL_TABS(제목
  // 표시용)는 이걸 그대로 쓰므로 마스터가 이 탭에 있을 때 제목이 정상 표시된다.
  { id: "admin-accounts", label: "Admins", icon: "settings" },
  // 2026-09-22(컨설턴트 포지션) — 관리자 전원이 쓴다(학생 배정은 운영 업무).
  { id: "consultants", label: "Consultants", icon: "consultations" },
] as const;

// 2026-09-10(UI/UX 1차 리뷰 지적) — "개발 로그"는 일반 운영 업무 중 볼 메뉴가
// 아니므로 데스크톱 사이드바·모바일 드로어 어디에도 노출하지 않는다. 완전히
// 없애지는 않고, `?tab=devlog` 직접 접근(내부 전용 경로)으로만 계속 열람할
// 수 있게 별도 목록으로 둔다 — NAV_ITEMS에는 넣지 않으므로 어떤 내비게이션
// 렌더링에도 등장하지 않는다.
const HIDDEN_TABS = [{ id: "devlog", label: "개발 로그", icon: "🧾" }] as const;

const ALL_TABS = [...NAV_ITEMS, ...HIDDEN_TABS] as const;

// 2026-09-10(P1-3) — 탭 id 유효성 판정은 admin-tabs.ts의 resolveAdminTab()로
// admin/page.tsx와 공유한다(둘이 어긋나면 탭과 SSR 데이터가 어긋난다).
type TabId = AdminTabId;

export default function AdminShell({
  initialTab,
  adminUserId,
  dashboard,
  subjects,
  docs,
  matchingStudents,
  consultations,
  trials,
  driveIssues,
  staleEnvelopes,
  contractActivationRetries,
  initialKanbanCards,
  initialInquiryThreads,
  initialUnifiedScheduleLessons,
  initialUnifiedScheduleMonthAnchor,
  initialBookingDashboard,
  devLogContent,
  payoutBatches,
  teacherCandidatesBySubject,
  workspaceProvisionings,
  entitlementProducts,
  entitlementProductVersions,
  openPriceChangeNotices,
  pendingRefundRequests,
  purchasesNeedingReconciliation,
  openOrRecentPaymentDisputes,
  googleLinkError,
  googleLinkSuccess,
  isMasterAdmin,
  adminAccounts,
  mockExamSets,
  consultants,
  unassignedConsultations,
  assignedAwaitingSchedule,
  autoAssignEnabled,
}: {
  initialTab?: string;
  // 2026-09-10(P1 재진입 성능 배치) — 탭 데이터 캐시(tab-data-cache.ts)를
  // "현재 로그인한 관리자"에 묶기 위한 id. 값이 바뀌면(계정 전환) 캐시를
  // 즉시 폐기한다.
  adminUserId: string;
  googleLinkError?: string;
  googleLinkSuccess?: boolean;
  dashboard: AdminDashboardData;
  subjects: AdminSubject[];
  docs: CurriculumDocListItem[];
  // 2026-09-10(P1 — 학부모 SSR 회귀 조사 후속) — 학부모 목록도 더 이상 SSR로
  // 안 내려온다. loadParents()가 admin/page.tsx의 거대한 Promise.all 안에서
  // 실패하면 "사용자" 탭이 아니라 admin 페이지 전체가 깨지던 문제를 없애기
  // 위해, 학생/선생님과 동일하게 UsersTab이 직접
  // listParentsForUsersTabAction()으로 조회한다.
  // 2026-09-10(P1) — "사용자" 탭의 학생/선생님 목록·수업권 이력·QC 경고는
  // 더 이상 SSR로 안 내려온다(UsersTab이 서브탭을 열 때 직접 조회). teachers/
  // qcWarningsByTeacher props 자체를 없앴다.
  // 2026-09-10(P1) — 매칭 탭 전용 경량 학생 목록(id·name·grade·parentNames·status).
  matchingStudents: MatchingStudentItem[];
  consultations: ConsultationListItem[];
  trials: TrialSessionListItem[];
  driveIssues: DriveArtifactIssue[];
  staleEnvelopes: StaleEnvelopeContract[];
  contractActivationRetries: ContractActivationRetryItem[];
  initialKanbanCards?: KanbanCard[];
  // 2026-09-10(P1 재진입 성능 배치) — 문의·면담/통합 일정/예약도 SSR로 초기
  // 데이터를 내려받아 첫 진입 시 "불러오는 중..." 빈 화면 대신 바로 콘텐츠를
  // 보여준다(신규 탭의 initialKanbanCards와 동일한 패턴).
  initialInquiryThreads?: AdminInquiryThread[];
  initialUnifiedScheduleLessons?: UnifiedScheduleLessonRow[];
  initialUnifiedScheduleMonthAnchor: string;
  initialBookingDashboard?: BookingReconciliationDashboard;
  devLogContent: string;
  payoutBatches: PayoutBatchListItem[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  workspaceProvisionings: WorkspaceProvisioningItem[];
  entitlementProducts: EntitlementProductListItem[];
  entitlementProductVersions: ProductVersionListItem[];
  openPriceChangeNotices: Awaited<ReturnType<typeof listOpenPriceChangeNotices>>;
  pendingRefundRequests: Awaited<ReturnType<typeof listPendingRefundRequests>>;
  purchasesNeedingReconciliation: Awaited<ReturnType<typeof listPurchasesNeedingReconciliation>>;
  openOrRecentPaymentDisputes: Awaited<ReturnType<typeof listOpenOrRecentPaymentDisputes>>;
  // 2026-09-22(관리자 계정 구조) — "Admins" nav 항목·탭 내용은 마스터만.
  isMasterAdmin: boolean;
  adminAccounts: AdminAccount[];
  mockExamSets?: MockExamSetSummary[];
  // 2026-09-22(컨설턴트 포지션) — 관리자 전원이 쓴다(마스터 전용 아님).
  consultants: ConsultantWithStudents[];
  unassignedConsultations: IntakeConsultation[];
  assignedAwaitingSchedule: IntakeConsultation[];
  autoAssignEnabled: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(resolveAdminTab(initialTab));
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);

  // 2026-09-10(P0-3 2차) — activeTab은 최초 마운트 시 initialTab으로만
  // 초기화되고, 이후 브라우저 뒤로가기/앞으로가기로 이 페이지의 URL(및 그에
  // 따라 새로 내려오는 initialTab prop)이 바뀌어도 useState 초기값은 다시
  // 계산되지 않는다(React의 통상적인 동작) — 그래서 주소창은 바뀌는데 화면은
  // 이전 탭에 멈춰 있는 어긋남이 재현됐다. initialTab이 바뀔 때마다
  // activeTab을 그 값으로 다시 맞춘다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(resolveAdminTab(initialTab));
  }, [initialTab]);

  // 2026-09-10(P1 재진입 성능 배치) — adminUserId가 이전과 다르면(계정 전환·
  // 권한 변경으로 세션이 바뀐 경우) 탭 데이터 캐시를 즉시 비운다.
  useEffect(() => {
    setActiveAdminUser(adminUserId);
  }, [adminUserId]);

  function selectTab(id: TabId) {
    setActiveTab(id);
    setAccountMenuOpen(false);
    // 2026-09-10(P0-3 2차) — 탭 전환을 replace에서 push로: 이전엔 매 탭
    // 전환이 히스토리 항목 하나(admin 진입 시점)를 계속 덮어써, 관리자 세션
    // 전체가 뒤로가기 한 번에 통째로 빠져나가 로그인/OAuth 이력으로
    // 건너뛰었다. push로 바꿔 탭 전환마다 되돌아갈 수 있는 자체 히스토리
    // 항목을 만든다(포털 밖으로 나가는 것과 포털 내부 탭 이동을 구분).
    router.push(`?tab=${id}`, { scroll: false });
  }

  const activeLabel = ALL_TABS.find((n) => n.id === activeTab)?.label ?? "";

  // 2026-09-10(UI/UX 정리 1차, 배치4) — 관리자는 항목이 많아(13개) 바텀탭
  // 대신 햄버거 드로어 + 그룹 헤더(운영/콘텐츠/정산)로 정리한다.
  const OPERATIONS_IDS: TabId[] = [
    "home",
    "users",
    "matching",
    "consult",
    "inquiry",
    "unified-schedule",
    "booking",
    // P4-3 — 여기 넣지 않으면 아래 mobileGroups의 기본 분류(그 외 = 정산)로
    // 떨어져 문서 탭이 정산 그룹에 표시된다.
    "documents",
    "workspace",
    "admin-accounts",
  ];
  const CONTENT_IDS: TabId[] = ["catalog", "problem-bank", "mock-exam"];
  // 2026-09-22(관리자 계정 구조) — "Admins"는 마스터(official@alton.education)만
  // 본다. isMasterAdmin은 admin_tier='master' 여부를 SSR에서 이미 확인한 값
  // (admin-accounts-data.ts의 서버 액션이 최종 방어선).
  const visibleNavItems = NAV_ITEMS.filter((n) => n.id !== "admin-accounts" || isMasterAdmin);
  const mobileGroups = [
    { label: "운영", items: visibleNavItems.filter((n) => OPERATIONS_IDS.includes(n.id)) },
    {
      label: "콘텐츠",
      items: visibleNavItems.filter((n) => CONTENT_IDS.includes(n.id)),
    },
    {
      label: "정산",
      items: visibleNavItems.filter((n) => !OPERATIONS_IDS.includes(n.id) && !CONTENT_IDS.includes(n.id)),
    },
  ];

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="hidden md:flex w-56 shrink-0 border-r border-grey-200 flex-col py-5 px-3 gap-0.5 overflow-y-auto">
        <div className="flex items-center gap-2 px-2.5 mb-5">
          <div className="w-8 h-8 rounded-full bg-red text-white font-extrabold text-[14px] flex items-center justify-center shrink-0">
            A
          </div>
          <span className="text-[13.5px] font-extrabold text-ink">ALTON</span>
        </div>
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            aria-current={activeTab === item.id ? "page" : undefined}
            className={
              "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors " +
              (activeTab === item.id ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
            }
          >
            <NavIcon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </button>
        ))}

        {/* 2026-09-19(UAT 반영) — Acely 레퍼런스: 계정 메뉴를 상단 헤더바가
            아니라 사이드바 맨 아래(프로필)로 옮긴다. 상단 헤더바 자체를
            없앤다. 위로 펼쳐지는 드롭다운(bottom-full). */}
        <div className="mt-auto pt-2 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-grey-100"
          >
            <div className="w-7 h-7 rounded-full bg-grey-100 text-ink font-extrabold text-[12px] flex items-center justify-center shrink-0">
              A
            </div>
            <span className="flex-1 text-left truncate">관리자</span>
            <NavIcon name="settings" className="w-4 h-4 shrink-0 text-grey-400" />
          </button>
          {accountMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
              <button
                onClick={() => selectTab("home")}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                홈으로
              </button>
              <div className="h-px bg-grey-200 my-1" />
              <form action={linkAdminGoogleAccount}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink">
                  Google 계정 연결
                </button>
              </form>
              <div className="h-px bg-grey-200 my-1" />
              <button
                onClick={() => {
                  setTimezoneModalOpen(true);
                  setAccountMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                시간대 설정
              </button>
              <div className="h-px bg-grey-200 my-1" />
              <form action={logout} onSubmit={() => clearAdminTabCache()}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-red">
                  로그아웃
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* 2026-09-19 — aside는 모바일에서 hidden(display:none)이라, 그 안에
          두면 모바일 계정 메뉴에서 연 모달이 함께 숨어 안 보인다. aside
          바깥(항상 렌더링되는 자리)에 둔다. */}
      {timezoneModalOpen && (
        <TimezoneSettingsModal
          showHouseholdDefault={false}
          onClose={() => setTimezoneModalOpen(false)}
        />
      )}

      <MobileDrawerNav groups={mobileGroups} activeId={activeTab} onSelect={(id) => selectTab(id as TabId)} />

      <div className="flex-1 flex flex-col">
        {/* 2026-09-19(UAT 반영) — 데스크톱은 계정 메뉴가 사이드바 맨 아래로
            옮겨져 상단 헤더바가 없다. 모바일은 사이드바가 숨겨지므로 계정
            메뉴만 담은 얇은 바를 여기 남긴다. */}
        <div className="md:hidden flex items-center justify-end gap-4 border-b border-grey-200 px-4 py-2.5 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="text-[13px] font-semibold text-ink"
          >
            관리자 ▾
          </button>
          {accountMenuOpen && (
            <div className="absolute top-full right-4 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
              <button
                onClick={() => selectTab("home")}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                홈으로
              </button>
              <div className="h-px bg-grey-200 my-1" />
              <form action={linkAdminGoogleAccount}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink">
                  Google 계정 연결
                </button>
              </form>
              <div className="h-px bg-grey-200 my-1" />
              <button
                onClick={() => {
                  setTimezoneModalOpen(true);
                  setAccountMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                시간대 설정
              </button>
              <div className="h-px bg-grey-200 my-1" />
              <form action={logout} onSubmit={() => clearAdminTabCache()}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-red">
                  로그아웃
                </button>
              </form>
            </div>
          )}
        </div>

        {(googleLinkError || googleLinkSuccess) && (
          <div
            className={
              "px-6 py-2.5 text-[13px] font-semibold border-b " +
              (googleLinkError
                ? "bg-red/5 text-red border-grey-200"
                : "bg-green/5 text-green border-grey-200")
            }
          >
            {googleLinkError ?? "Google 계정이 연결되었습니다."}
          </div>
        )}

        {/* 2026-09-19(UI 통일화) — 홈(자체 대시보드 헤더)을 뺀 나머지 탭은
            전부 같은 프레임(영어 제목 + 가운데 정렬 컬럼) 안에서 렌더링된다.
            관리자 화면은 표·대시보드가 많아 기본보다 넓은 폭을 쓴다. */}
        <div className="flex-1">
        {activeTab === "home" ? (
          <AdminHomeDashboard data={dashboard} onNavigate={selectTab} />
        ) : (
        <PageFrame title={activeLabel} maxWidthClassName="max-w-7xl">
          {activeTab === "catalog" ? (
            <CatalogTab subjects={subjects} docs={docs} />
          ) : activeTab === "problem-bank" ? (
            <ProblemBankTab subjects={subjects} />
          ) : activeTab === "mock-exam" ? (
            <MockExamTab initialSets={mockExamSets} />
          ) : activeTab === "users" ? (
            <UsersTab subjects={subjects} />
          ) : activeTab === "entitlements" ? (
            <EntitlementLedgerTab
              products={entitlementProducts}
              productVersions={entitlementProductVersions}
              openPriceChangeNotices={openPriceChangeNotices}
              pendingRefundRequests={pendingRefundRequests}
              purchasesNeedingReconciliation={purchasesNeedingReconciliation}
              openOrRecentPaymentDisputes={openOrRecentPaymentDisputes}
            />
          ) : activeTab === "unified-schedule" ? (
            <UnifiedScheduleTab
              initialLessons={initialUnifiedScheduleLessons}
              initialMonthAnchor={initialUnifiedScheduleMonthAnchor}
            />
          ) : activeTab === "booking" ? (
            <BookingReconciliationPanel initialDashboard={initialBookingDashboard} />
          ) : activeTab === "consult" ? (
            <ConsultationTab
              consultations={consultations}
              trials={trials}
              driveIssues={driveIssues}
              staleEnvelopes={staleEnvelopes}
              contractActivationRetries={contractActivationRetries}
              subjects={subjects}
              teacherCandidatesBySubject={teacherCandidatesBySubject}
              initialKanbanCards={initialKanbanCards}
            />
          ) : activeTab === "inquiry" ? (
            <InquiryAndMeetingTab initialThreads={initialInquiryThreads} />
          ) : activeTab === "devlog" ? (
            <DevLogTab content={devLogContent} />
          ) : activeTab === "payouts" ? (
            <PayoutBatchesTab initialBatches={payoutBatches} />
          ) : activeTab === "matching" ? (
            <MatchingTab
              students={matchingStudents}
              subjects={subjects}
              teacherCandidatesBySubject={teacherCandidatesBySubject}
            />
          ) : activeTab === "documents" ? (
            <DocumentsTab />
          ) : activeTab === "workspace" ? (
            <WorkspaceTab provisionings={workspaceProvisionings} />
          ) : activeTab === "admin-accounts" ? (
            isMasterAdmin ? (
              <AdminAccountsTab initialAccounts={adminAccounts} />
            ) : (
              <div className="p-8 text-[14px] text-grey-500">마스터 관리자만 볼 수 있습니다.</div>
            )
          ) : activeTab === "consultants" ? (
            <ConsultantAssignmentsTab
              initialConsultants={consultants}
              initialUnassignedConsultations={unassignedConsultations}
              initialAssignedAwaitingSchedule={assignedAwaitingSchedule}
              initialAutoAssignEnabled={autoAssignEnabled}
            />
          ) : (
            <div className="p-8 text-[14px] text-grey-500">
              {activeLabel} 탭은 준비 중입니다.
            </div>
          )}
        </PageFrame>
        )}
        </div>
      </div>
    </div>
  );
}
