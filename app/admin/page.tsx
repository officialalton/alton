import { requireUser } from "@/lib/auth";
import { loadAdminDashboard } from "./dashboard-data";
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
import AdminShell from "./AdminShell";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; googleLinkError?: string; googleLinkSuccess?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab, googleLinkError, googleLinkSuccess } = await searchParams;

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
    loadAdminDashboard(supabase, user.id),
    loadSubjectCatalog(supabase),
    loadAllCurriculumDocs(supabase),
    loadParents(supabase),
    loadStudents(supabase),
    loadTeachers(supabase),
    loadConsultations(supabase),
    loadTrialSessions(supabase),
    loadProposals(supabase),
    loadConsentGaps(supabase),
    loadCompletedConsents(supabase),
    loadDriveArtifactIssues(supabase),
    loadStaleEnvelopeVersions(supabase),
    listOpenContractActivationRetries(),
    loadPayoutBatches(supabase),
    loadTeacherCandidatesBySubject(supabase),
    loadWorkspaceProvisionings(supabase),
    loadEntitlementProducts(supabase),
    loadEntitlementProductVersions(supabase),
    listOpenPriceChangeNotices(),
    listPendingRefundRequests(),
    listPurchasesNeedingReconciliation(),
    listOpenOrRecentPaymentDisputes(),
  ]);

  // 성능 corrective(2026-09-09): 학생/교사 수와 무관하게 각각 배치 쿼리 1회씩만
  // 실행한다(기존: 학생/교사 각각 개별 호출하는 N+1 — admin 페이지 최악 TTFB의 원인).
  const [creditHistoryByStudent, qcWarningsByTeacher] = await Promise.all([
    loadStudentCreditHistoryBatch(supabase, students.map((s) => s.id)),
    loadTeacherQcWarningsBatch(supabase, teachers.map((t) => t.id)),
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
