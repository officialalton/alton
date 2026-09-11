"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileDrawerNav from "@/app/components/MobileDrawerNav";
import { linkAdminGoogleAccount } from "./google-link-actions";
import { resolveAdminTab, type AdminTabId } from "./admin-tabs";
import { setActiveAdminUser, clearAdminTabCache } from "./tab-data-cache";
import AdminHomeDashboard from "./AdminHomeDashboard";
import type { AdminDashboardData } from "./dashboard-data";
import CatalogTab from "./CatalogTab";
import UsersTab from "./UsersTab";
import BillingTab from "./BillingTab";
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
  ProposalListItem,
  ConsentGapItem,
  CompletedConsentItem,
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
import type {
  CreditTransaction,
  ParentListItem,
  StudentListItem,
} from "./users-data";

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "users", label: "사용자", icon: "👥" },
  { id: "matching", label: "매칭", icon: "🔗" },
  { id: "consult", label: "상담", icon: "🗓" },
  { id: "inquiry", label: "문의·면담", icon: "💬" },
  { id: "catalog", label: "커리큘럼", icon: "📘" },
  { id: "billing", label: "구 크레딧(레거시)", icon: "💳" },
  { id: "entitlements", label: "수업권", icon: "🎫" },
  { id: "unified-schedule", label: "통합 일정", icon: "🗺️" },
  { id: "booking", label: "예약", icon: "🗓️" },
  { id: "payouts", label: "정산", icon: "💸" },
  { id: "workspace", label: "Workspace", icon: "🔑" },
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
  parents,
  students,
  creditHistoryByStudent,
  matchingStudents,
  consultations,
  trials,
  proposals,
  consentGaps,
  completedConsents,
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
  parents: ParentListItem[];
  // 2026-09-10(P1) — "사용자" 탭의 학생/선생님 목록·수업권 이력·QC 경고는
  // 더 이상 SSR로 안 내려온다(UsersTab이 서브탭을 열 때 직접 조회). students는
  // 이제 "구 크레딧(레거시)" 탭에서만 쓴다. teachers/qcWarningsByTeacher
  // props 자체를 없앴다.
  students: StudentListItem[];
  creditHistoryByStudent: Record<string, CreditTransaction[]>;
  // 2026-09-10(P1) — 매칭 탭 전용 경량 학생 목록(id·name·grade·parentNames·status).
  matchingStudents: MatchingStudentItem[];
  consultations: ConsultationListItem[];
  trials: TrialSessionListItem[];
  proposals: ProposalListItem[];
  consentGaps: ConsentGapItem[];
  completedConsents: CompletedConsentItem[];
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
    "workspace",
  ];
  const CONTENT_IDS: TabId[] = ["catalog"];
  const mobileGroups = [
    { label: "운영", items: NAV_ITEMS.filter((n) => OPERATIONS_IDS.includes(n.id)) },
    { label: "콘텐츠", items: NAV_ITEMS.filter((n) => CONTENT_IDS.includes(n.id)) },
    { label: "정산", items: NAV_ITEMS.filter((n) => !OPERATIONS_IDS.includes(n.id) && !CONTENT_IDS.includes(n.id)) },
  ];

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="hidden md:flex w-[88px] shrink-0 border-r border-grey-200 flex-col items-center py-5 gap-1">
        <div className="w-9 h-9 rounded-full bg-red text-white font-extrabold text-[15px] flex items-center justify-center mb-4">
          A
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            className={
              "w-full flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold " +
              (activeTab === item.id ? "text-ink" : "text-grey-300")
            }
          >
            <span className="text-[17px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      <MobileDrawerNav groups={mobileGroups} activeId={activeTab} onSelect={(id) => selectTab(id as TabId)} />

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-end gap-4 border-b border-grey-200 px-6 py-3 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="text-[13px] font-semibold text-ink"
          >
            관리자 ▾
          </button>
          {accountMenuOpen && (
            <div className="absolute top-full right-6 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
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
          {timezoneModalOpen && (
            <TimezoneSettingsModal
              showHouseholdDefault={false}
              onClose={() => setTimezoneModalOpen(false)}
            />
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

        <div className="flex-1">
          {activeTab === "home" ? (
            <AdminHomeDashboard data={dashboard} onNavigate={selectTab} />
          ) : activeTab === "catalog" ? (
            <CatalogTab subjects={subjects} docs={docs} />
          ) : activeTab === "users" ? (
            <UsersTab initialParents={parents} subjects={subjects} />
          ) : activeTab === "billing" ? (
            <BillingTab
              initialStudents={students}
              creditHistoryByStudent={creditHistoryByStudent}
            />
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
              proposals={proposals}
              consentGaps={consentGaps}
              completedConsents={completedConsents}
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
          ) : activeTab === "workspace" ? (
            <WorkspaceTab provisionings={workspaceProvisionings} />
          ) : (
            <div className="p-8 text-[14px] text-grey-500">
              {activeLabel} 탭은 준비 중입니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
