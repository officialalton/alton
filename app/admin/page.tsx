import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadAdminDashboard, type AdminDashboardData } from "./dashboard-data";
import { loadSubjectCatalog } from "./subject-data";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";
import {
  loadParents,
  loadStudents,
  loadTeachers,
  loadStudentCreditHistoryBatch,
  loadTeacherQcWarningsBatch,
} from "./users-data";
import {
  loadConsultations,
  loadTrialSessions,
  loadProposals,
  loadConsentGaps,
  loadCompletedConsents,
  loadDriveArtifactIssues,
  loadStaleEnvelopeVersions,
} from "./consultation-data";
import { listOpenContractActivationRetries } from "./consultation-actions";
import { loadKanbanBoard } from "./consultation-kanban-data";
import { loadDevLog } from "./dev-log-data";
import { loadPayoutBatches } from "./payout-batches-data";
import { loadTeacherCandidatesBySubject } from "./matching-data";
import { loadWorkspaceProvisionings } from "./workspace-data";
import { loadEntitlementProducts, loadEntitlementProductVersions } from "./entitlement-data";
import {
  listOpenPriceChangeNotices,
  listPendingRefundRequests,
  listPurchasesNeedingReconciliation,
  listOpenOrRecentPaymentDisputes,
} from "./entitlement-actions";
import { resolveAdminTab } from "./admin-tabs";
import AdminShell from "./AdminShell";

const EMPTY_DASHBOARD: AdminDashboardData = {
  adminName: "",
  pendingConsults: [],
  upcomingConsults: [],
  pendingStudents: [],
  pendingTeachers: [],
  qcWarnings: [],
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; googleLinkError?: string; googleLinkSuccess?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab, googleLinkError, googleLinkSuccess } = await searchParams;

  // 2026-09-10(P1-3) — 탭별 SSR 로딩 분리. 이전엔 어느 탭에 있든 매 탭 전환(=이
  // 서버 컴포넌트 재실행)마다 23개+후속 2개 로더를 전부 실행했다(P1-1에서
  // 측정·확인). AdminShell과 동일한 resolveAdminTab()으로 "지금 보여줄 탭"을
  // 정하고, 그 탭이 실제로 쓰는 로더만 실행한다 — 클라이언트 재조회로 옮기는
  // 게 아니라 이 SSR 응답 자체에서 필요한 것만 조회하므로 왕복이 늘지 않는다
  // (탭 전환은 이미 이 서버 컴포넌트를 다시 타는 RSC 왕복이라 — P1-1 결론).
  const activeTab = resolveAdminTab(tab);
  const need = (...tabs: string[]) => tabs.includes(activeTab);

  const devLogContent = loadDevLog();

  const [
    dashboard,
    subjects,
    docs,
    parents,
    students,
    teachers,
    consultations,
    trials,
    proposals,
    consentGaps,
    completedConsents,
    driveIssues,
    staleEnvelopes,
    contractActivationRetries,
    initialKanbanCards,
    payoutBatches,
    teacherCandidatesBySubject,
    workspaceProvisionings,
    entitlementProducts,
    entitlementProductVersions,
    openPriceChangeNotices,
    pendingRefundRequests,
    purchasesNeedingReconciliation,
    openOrRecentPaymentDisputes,
  ] = await Promise.all([
    need("home") ? loadAdminDashboard(supabase, user.id) : Promise.resolve(EMPTY_DASHBOARD),
    need("catalog", "users", "consult", "matching") ? loadSubjectCatalog(supabase) : Promise.resolve([]),
    need("catalog") ? loadAllCurriculumDocs(supabase) : Promise.resolve([]),
    need("users") ? loadParents(supabase) : Promise.resolve([]),
    need("users", "billing", "matching") ? loadStudents(supabase) : Promise.resolve([]),
    need("users") ? loadTeachers(supabase) : Promise.resolve([]),
    need("consult") ? loadConsultations(supabase) : Promise.resolve([]),
    need("consult") ? loadTrialSessions(supabase) : Promise.resolve([]),
    need("consult") ? loadProposals(supabase) : Promise.resolve([]),
    need("consult") ? loadConsentGaps(supabase) : Promise.resolve([]),
    need("consult") ? loadCompletedConsents(supabase) : Promise.resolve([]),
    need("consult") ? loadDriveArtifactIssues(supabase) : Promise.resolve([]),
    need("consult") ? loadStaleEnvelopeVersions(supabase) : Promise.resolve([]),
    need("consult") ? listOpenContractActivationRetries() : Promise.resolve([]),
    need("consult") ? loadKanbanBoard(createAdminClient()) : Promise.resolve(undefined),
    need("payouts") ? loadPayoutBatches(supabase) : Promise.resolve([]),
    need("consult", "matching") ? loadTeacherCandidatesBySubject(supabase) : Promise.resolve({}),
    need("workspace") ? loadWorkspaceProvisionings(supabase) : Promise.resolve([]),
    need("entitlements") ? loadEntitlementProducts(supabase) : Promise.resolve([]),
    need("entitlements") ? loadEntitlementProductVersions(supabase) : Promise.resolve([]),
    need("entitlements") ? listOpenPriceChangeNotices() : Promise.resolve([]),
    need("entitlements") ? listPendingRefundRequests() : Promise.resolve([]),
    need("entitlements") ? listPurchasesNeedingReconciliation() : Promise.resolve([]),
    need("entitlements") ? listOpenOrRecentPaymentDisputes() : Promise.resolve([]),
  ]);

  // 성능 corrective(2026-09-09): 학생/교사 수와 무관하게 각각 배치 쿼리 1회씩만
  // 실행한다(기존: 학생/교사 각각 개별 호출하는 N+1 — admin 페이지 최악 TTFB의 원인).
  const [creditHistoryByStudent, qcWarningsByTeacher] = await Promise.all([
    need("users", "billing") ? loadStudentCreditHistoryBatch(supabase, students.map((s) => s.id)) : Promise.resolve({}),
    need("users") ? loadTeacherQcWarningsBatch(supabase, teachers.map((t) => t.id)) : Promise.resolve({}),
  ]);

  return (
    <AdminShell
      initialTab={tab}
      googleLinkError={googleLinkError}
      googleLinkSuccess={!!googleLinkSuccess}
      dashboard={dashboard}
      subjects={subjects}
      docs={docs}
      parents={parents}
      students={students}
      teachers={teachers}
      creditHistoryByStudent={creditHistoryByStudent}
      qcWarningsByTeacher={qcWarningsByTeacher}
      consultations={consultations}
      trials={trials}
      proposals={proposals}
      consentGaps={consentGaps}
      completedConsents={completedConsents}
      driveIssues={driveIssues}
      staleEnvelopes={staleEnvelopes}
      contractActivationRetries={contractActivationRetries}
      initialKanbanCards={initialKanbanCards}
      devLogContent={devLogContent}
      payoutBatches={payoutBatches}
      teacherCandidatesBySubject={teacherCandidatesBySubject}
      workspaceProvisionings={workspaceProvisionings}
      entitlementProducts={entitlementProducts}
      entitlementProductVersions={entitlementProductVersions}
      openPriceChangeNotices={openPriceChangeNotices}
      pendingRefundRequests={pendingRefundRequests}
      purchasesNeedingReconciliation={purchasesNeedingReconciliation}
      openOrRecentPaymentDisputes={openOrRecentPaymentDisputes}
    />
  );
}
