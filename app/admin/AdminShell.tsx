"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import { linkAdminGoogleAccount } from "./google-link-actions";
import AdminHomeDashboard from "./AdminHomeDashboard";
import type { AdminDashboardData } from "./dashboard-data";
import CatalogTab from "./CatalogTab";
import UsersTab from "./UsersTab";
import BillingTab from "./BillingTab";
import ContractsTab from "./ContractsTab";
import type { AcceptedProposalForContract, FamilyContract, PendingConsult } from "./contracts-data";
import ConsultationTab from "./ConsultationTab";
import type {
  ConsultationListItem,
  TrialSessionListItem,
  ProposalListItem,
  ConsentGapItem,
  AiNotesConsentEventItem,
  DriveArtifactIssue,
  StaleEnvelopeContract,
} from "./consultation-data";
import type { ContractActivationRetryItem } from "./consultation-actions";
import DevLogTab from "./DevLogTab";
import PayoutsTab from "./PayoutsTab";
import type { PayoutListItem } from "./payouts-data";
import MatchingTab from "./MatchingTab";
import type { MatchingTeacherCandidate } from "./matching-data";
import WorkspaceTab from "./WorkspaceTab";
import type { WorkspaceProvisioningItem } from "./workspace-data";
import EntitlementLedgerTab from "./EntitlementLedgerTab";
import type { EntitlementProductListItem, ProductVersionListItem } from "./entitlement-data";
import type {
  listOpenPriceChangeNotices,
  listPendingRefundRequests,
  listPurchasesNeedingReconciliation,
} from "./entitlement-actions";
import type { AdminSubject } from "./subject-data";
import type { DocEditorData } from "./curriculum-doc-data";
import type {
  CreditTransaction,
  ParentListItem,
  QcWarning,
  StudentListItem,
  TeacherListItem,
} from "./users-data";

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "users", label: "사용자", icon: "👥" },
  { id: "matching", label: "매칭", icon: "🔗" },
  { id: "consult", label: "상담", icon: "🗓" },
  { id: "catalog", label: "커리큘럼", icon: "📘" },
  { id: "billing", label: "구 크레딧(레거시)", icon: "💳" },
  { id: "entitlements", label: "수업권", icon: "🎫" },
  { id: "contracts", label: "계약", icon: "📄" },
  { id: "qc", label: "QC", icon: "🛡" },
  { id: "payouts", label: "정산", icon: "💸" },
  { id: "workspace", label: "Workspace", icon: "🔑" },
  { id: "documents", label: "문서", icon: "📁" },
  { id: "devlog", label: "개발 로그", icon: "🧾" },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

export default function AdminShell({
  initialTab,
  dashboard,
  subjects,
  docs,
  parents,
  students,
  teachers,
  creditHistoryByStudent,
  qcWarningsByTeacher,
  pendingConsults,
  familyContracts,
  acceptedProposalsForContract,
  consultations,
  trials,
  proposals,
  consentGaps,
  aiNotesEvents,
  driveIssues,
  staleEnvelopes,
  contractActivationRetries,
  devLogContent,
  payouts,
  teacherCandidatesBySubject,
  workspaceProvisionings,
  entitlementProducts,
  entitlementProductVersions,
  openPriceChangeNotices,
  pendingRefundRequests,
  purchasesNeedingReconciliation,
  googleLinkError,
  googleLinkSuccess,
}: {
  initialTab?: string;
  googleLinkError?: string;
  googleLinkSuccess?: boolean;
  dashboard: AdminDashboardData;
  subjects: AdminSubject[];
  docs: DocEditorData[];
  parents: ParentListItem[];
  students: StudentListItem[];
  teachers: TeacherListItem[];
  creditHistoryByStudent: Record<string, CreditTransaction[]>;
  qcWarningsByTeacher: Record<string, QcWarning[]>;
  pendingConsults: PendingConsult[];
  familyContracts: FamilyContract[];
  acceptedProposalsForContract: AcceptedProposalForContract[];
  consultations: ConsultationListItem[];
  trials: TrialSessionListItem[];
  proposals: ProposalListItem[];
  consentGaps: ConsentGapItem[];
  aiNotesEvents: AiNotesConsentEventItem[];
  driveIssues: DriveArtifactIssue[];
  staleEnvelopes: StaleEnvelopeContract[];
  contractActivationRetries: ContractActivationRetryItem[];
  devLogContent: string;
  payouts: PayoutListItem[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  workspaceProvisionings: WorkspaceProvisioningItem[];
  entitlementProducts: EntitlementProductListItem[];
  entitlementProductVersions: ProductVersionListItem[];
  openPriceChangeNotices: Awaited<ReturnType<typeof listOpenPriceChangeNotices>>;
  pendingRefundRequests: Awaited<ReturnType<typeof listPendingRefundRequests>>;
  purchasesNeedingReconciliation: Awaited<ReturnType<typeof listPurchasesNeedingReconciliation>>;
}) {
  const router = useRouter();
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  function selectTab(id: TabId) {
    setActiveTab(id);
    setAccountMenuOpen(false);
    router.replace(`?tab=${id}`, { scroll: false });
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-[88px] shrink-0 border-r border-grey-200 flex flex-col items-center py-5 gap-1">
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
              <form action={logout}>
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

        <div className="flex-1">
          {activeTab === "home" ? (
            <AdminHomeDashboard data={dashboard} />
          ) : activeTab === "catalog" ? (
            <CatalogTab subjects={subjects} docs={docs} />
          ) : activeTab === "users" ? (
            <UsersTab
              initialParents={parents}
              initialStudents={students}
              initialTeachers={teachers}
              subjects={subjects}
              creditHistoryByStudent={creditHistoryByStudent}
              qcWarningsByTeacher={qcWarningsByTeacher}
            />
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
            />
          ) : activeTab === "contracts" ? (
            <ContractsTab contracts={familyContracts} acceptedProposals={acceptedProposalsForContract} />
          ) : activeTab === "consult" ? (
            <ConsultationTab
              consultations={consultations}
              trials={trials}
              proposals={proposals}
              consentGaps={consentGaps}
              aiNotesEvents={aiNotesEvents}
              driveIssues={driveIssues}
              staleEnvelopes={staleEnvelopes}
              contractActivationRetries={contractActivationRetries}
            />
          ) : activeTab === "devlog" ? (
            <DevLogTab content={devLogContent} />
          ) : activeTab === "payouts" ? (
            <PayoutsTab initialPayouts={payouts} />
          ) : activeTab === "matching" ? (
            <MatchingTab
              students={students}
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
