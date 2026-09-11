import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadAdminDashboard, type AdminDashboardData } from "./dashboard-data";
import { loadSubjectCatalog } from "./subject-data";
import { loadCurriculumDocList } from "./curriculum-doc-data";
import { loadParents, loadStudents, loadStudentCreditHistoryBatch } from "./users-data";
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
import { loadTeacherCandidatesBySubject, loadStudentsForMatching } from "./matching-data";
import { loadWorkspaceProvisionings } from "./workspace-data";
import { listInquiryThreadsForAdmin } from "./inquiry-and-meeting-actions";
import { listAllTeacherLessons, loadBookingReconciliationDashboardAction } from "./booking-actions";
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

  // 2026-09-10(P1 재진입 성능 배치) — 통합 일정은 전체 150일을 매번 읽는 대신
  // "현재 화면에 표시할 달 ± 1개월"만 SSR로 읽는다. 이 기본 범위는 오늘이
  // 속한 달을 기준으로 하고, 관리자가 달력에서 다른 달로 이동하면
  // UnifiedScheduleTab이 그 달 범위만 클라이언트에서 추가 조회한다(캐시에
  // 없는 달만 새로 조회 — 이미 본 달은 재요청하지 않음).
  const now = new Date();
  const unifiedScheduleMonthAnchor = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const unifiedScheduleRangeFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const unifiedScheduleRangeTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59)).toISOString();

  const [
    dashboard,
    subjects,
    docs,
    parents,
    students,
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
    initialBookingDashboard,
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
    need("catalog") ? loadCurriculumDocList(supabase) : Promise.resolve([]),
    need("users") ? loadParents(supabase) : Promise.resolve([]),
    need("billing") ? loadStudents(supabase) : Promise.resolve([]),
    need("matching") ? loadStudentsForMatching(supabase) : Promise.resolve([]),
    need("consult") ? loadConsultations(supabase) : Promise.resolve([]),
    need("consult") ? loadTrialSessions(supabase) : Promise.resolve([]),
    need("consult") ? loadProposals(supabase) : Promise.resolve([]),
    need("consult") ? loadConsentGaps(supabase) : Promise.resolve([]),
    need("consult") ? loadCompletedConsents(supabase) : Promise.resolve([]),
    need("consult") ? loadDriveArtifactIssues(supabase) : Promise.resolve([]),
    need("consult") ? loadStaleEnvelopeVersions(supabase) : Promise.resolve([]),
    need("consult") ? listOpenContractActivationRetries() : Promise.resolve([]),
    need("consult") ? loadKanbanBoard(createAdminClient()) : Promise.resolve(undefined),
    need("inquiry") ? listInquiryThreadsForAdmin() : Promise.resolve(undefined),
    need("unified-schedule")
      ? listAllTeacherLessons({ from: unifiedScheduleRangeFrom, to: unifiedScheduleRangeTo })
      : Promise.resolve(undefined),
    need("booking") ? loadBookingReconciliationDashboardAction() : Promise.resolve(undefined),
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

  // 성능 corrective(2026-09-09, 2026-09-10 갱신): "사용자" 탭의 학생/선생님
  // 목록·이력은 이제 UsersTab이 서브탭을 열 때 listStudentsForUsersTabAction/
  // listTeachersForUsersTabAction으로 지연 조회한다 — 여기서는 "billing" 탭이
  // 계속 SSR로 필요로 하는 학생 수업권 이력만 배치로 읽는다.
  const creditHistoryByStudent = need("billing")
    ? await loadStudentCreditHistoryBatch(supabase, students.map((s) => s.id))
    : {};

  return (
    <AdminShell
      initialTab={tab}
      adminUserId={user.id}
      googleLinkError={googleLinkError}
      googleLinkSuccess={!!googleLinkSuccess}
      dashboard={dashboard}
      subjects={subjects}
      docs={docs}
      parents={parents}
      students={students}
      matchingStudents={matchingStudents}
      creditHistoryByStudent={creditHistoryByStudent}
      consultations={consultations}
      trials={trials}
      proposals={proposals}
      consentGaps={consentGaps}
      completedConsents={completedConsents}
      driveIssues={driveIssues}
      staleEnvelopes={staleEnvelopes}
      contractActivationRetries={contractActivationRetries}
      initialKanbanCards={initialKanbanCards}
      initialInquiryThreads={initialInquiryThreads}
      initialUnifiedScheduleLessons={initialUnifiedScheduleLessons}
      initialUnifiedScheduleMonthAnchor={unifiedScheduleMonthAnchor}
      initialBookingDashboard={initialBookingDashboard}
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
