import { requireUser } from "@/lib/auth";
import { loadAdminDashboard } from "./dashboard-data";
import { loadSubjectCatalog } from "./subject-data";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";
import {
  loadParents,
  loadStudents,
  loadTeachers,
  loadStudentCreditHistory,
  loadTeacherQcWarnings,
} from "./users-data";
import { loadPendingConsults, loadFamilyContracts, loadAcceptedProposalsForContract } from "./contracts-data";
import {
  loadConsultations,
  loadTrialSessions,
  loadProposals,
  loadConsentGaps,
  loadAiNotesConsentEvents,
  loadDriveArtifactIssues,
  loadStaleEnvelopeVersions,
} from "./consultation-data";
import { listOpenContractActivationRetries } from "./consultation-actions";
import { loadDevLog } from "./dev-log-data";
import { loadPayouts } from "./payouts-data";
import { loadTeacherCandidatesBySubject } from "./matching-data";
import { loadWorkspaceProvisionings } from "./workspace-data";
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
    payouts,
    teacherCandidatesBySubject,
    workspaceProvisionings,
  ] = await Promise.all([
    loadAdminDashboard(supabase, user.id),
    loadSubjectCatalog(supabase),
    loadAllCurriculumDocs(supabase),
    loadParents(supabase),
    loadStudents(supabase),
    loadTeachers(supabase),
    loadPendingConsults(supabase),
    loadFamilyContracts(supabase),
    loadAcceptedProposalsForContract(supabase),
    loadConsultations(supabase),
    loadTrialSessions(supabase),
    loadProposals(supabase),
    loadConsentGaps(supabase),
    loadAiNotesConsentEvents(supabase),
    loadDriveArtifactIssues(supabase),
    loadStaleEnvelopeVersions(supabase),
    listOpenContractActivationRetries(),
    loadPayouts(supabase),
    loadTeacherCandidatesBySubject(supabase),
    loadWorkspaceProvisionings(supabase),
  ]);

  const [creditHistoryEntries, qcWarningsEntries] = await Promise.all([
    Promise.all(
      students.map(async (s) => [s.id, await loadStudentCreditHistory(supabase, s.id)] as const)
    ),
    Promise.all(
      teachers.map(async (t) => [t.id, await loadTeacherQcWarnings(supabase, t.id)] as const)
    ),
  ]);
  const creditHistoryByStudent = Object.fromEntries(creditHistoryEntries) as Record<
    string,
    Awaited<ReturnType<typeof loadStudentCreditHistory>>
  >;
  const qcWarningsByTeacher = Object.fromEntries(qcWarningsEntries) as Record<
    string,
    Awaited<ReturnType<typeof loadTeacherQcWarnings>>
  >;

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
      pendingConsults={pendingConsults}
      familyContracts={familyContracts}
      acceptedProposalsForContract={acceptedProposalsForContract}
      consultations={consultations}
      trials={trials}
      proposals={proposals}
      consentGaps={consentGaps}
      aiNotesEvents={aiNotesEvents}
      driveIssues={driveIssues}
      staleEnvelopes={staleEnvelopes}
      contractActivationRetries={contractActivationRetries}
      devLogContent={devLogContent}
      payouts={payouts}
      teacherCandidatesBySubject={teacherCandidatesBySubject}
      workspaceProvisionings={workspaceProvisionings}
    />
  );
}
