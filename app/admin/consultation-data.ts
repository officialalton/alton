import type { SupabaseClient } from "@supabase/supabase-js";

// R3 관리자 UI용 읽기 전용 데이터 로더. 쓰기는 전부 consultation-actions.ts의
// "use server" 액션을 클라이언트 컴포넌트에서 직접 호출한다(기존 ContractsTab/
// MatchingTab과 동일한 관행) — 여기서는 최초 페이지 로드에 필요한 목록만 만든다.

export type ConsultationListItem = {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  studentGrade: string | null;
  category: string | null;
  concerns: string | null;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  cancellationReason: string | null;
  householdId: string | null;
  childId: string | null;
  duplicateOfConsultationId: string | null;
  createdAt: string;
  tagLabels: string[];
};

export async function loadConsultations(supabase: SupabaseClient): Promise<ConsultationListItem[]> {
  const { data: rows } = await supabase
    .from("consultations")
    .select(
      "id, contact_name, contact_email, contact_phone, student_grade, category, concerns, status, scheduled_at, completed_at, cancelled_at, no_show_at, cancellation_reason, household_id, child_id, duplicate_of_consultation_id, requested_at"
    )
    .order("requested_at", { ascending: false });
  if (!rows || rows.length === 0) return [];

  const { data: tagJoins } = await supabase
    .from("consultation_classification_tags")
    .select("consultation_id, classification_tags(label)")
    .in(
      "consultation_id",
      rows.map((r) => r.id)
    );

  const tagsByConsultation = new Map<string, string[]>();
  for (const j of tagJoins ?? []) {
    const label = (j as { classification_tags?: { label?: string } }).classification_tags?.label;
    if (!label) continue;
    const list = tagsByConsultation.get(j.consultation_id) ?? [];
    list.push(label);
    tagsByConsultation.set(j.consultation_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    studentGrade: r.student_grade,
    category: r.category,
    concerns: r.concerns,
    status: r.status,
    scheduledAt: r.scheduled_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    noShowAt: r.no_show_at,
    cancellationReason: r.cancellation_reason,
    householdId: r.household_id,
    childId: r.child_id,
    duplicateOfConsultationId: r.duplicate_of_consultation_id,
    createdAt: r.requested_at,
    tagLabels: tagsByConsultation.get(r.id) ?? [],
  }));
}

export type TrialSessionListItem = {
  id: string;
  consultationId: string;
  childId: string;
  childName: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
  scheduledAt: string;
  status: string;
  goal: string | null;
  resultNotes: string | null;
  recommendation: string | null;
  recommendedTeacherId: string | null;
  payable: boolean;
  exceptionApprovedBy: string | null;
  exceptionReason: string | null;
};

export async function loadTrialSessions(supabase: SupabaseClient): Promise<TrialSessionListItem[]> {
  const { data: rows } = await supabase
    .from("trial_sessions")
    .select(
      "id, consultation_id, child_id, subject_id, teacher_id, scheduled_at, status, goal, result_notes, recommendation, recommended_teacher_id, payable, exception_approved_by, exception_reason"
    )
    .order("scheduled_at", { ascending: false });
  if (!rows || rows.length === 0) return [];

  const profileIds = Array.from(new Set(rows.map((r) => r.child_id).concat(rows.map((r) => r.teacher_id))));
  const subjectIds = Array.from(new Set(rows.map((r) => r.subject_id)));

  const [{ data: profiles }, { data: subjects }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", profileIds),
    supabase.from("subjects").select("id, name").in("id", subjectIds),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    id: r.id,
    consultationId: r.consultation_id,
    childId: r.child_id,
    childName: nameById.get(r.child_id) ?? null,
    subjectId: r.subject_id,
    subjectName: subjectNameById.get(r.subject_id) ?? null,
    teacherId: r.teacher_id,
    teacherName: nameById.get(r.teacher_id) ?? null,
    scheduledAt: r.scheduled_at,
    status: r.status,
    goal: r.goal,
    resultNotes: r.result_notes,
    recommendation: r.recommendation,
    recommendedTeacherId: r.recommended_teacher_id,
    payable: r.payable,
    exceptionApprovedBy: r.exception_approved_by,
    exceptionReason: r.exception_reason,
  }));
}

export type ProposalListItem = {
  id: string;
  consultationId: string;
  trialSessionId: string | null;
  versionNumber: number;
  supersedesProposalId: string | null;
  status: string;
  recommendedSubjects: Array<{
    subjectId: string;
    recommendedSessionCount: number | null;
    priceMinor: number | null;
    currency: string;
  }>;
  recommendedTeacherId: string | null;
  recommendedSessionCount: number | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
};

export async function loadProposals(supabase: SupabaseClient): Promise<ProposalListItem[]> {
  const { data: rows } = await supabase
    .from("proposals")
    .select(
      "id, consultation_id, trial_session_id, version_number, supersedes_proposal_id, status, recommended_subjects, recommended_teacher_id, recommended_session_count, sent_at, responded_at, created_at"
    )
    .order("created_at", { ascending: false });
  return (rows ?? []).map((r) => ({
    id: r.id,
    consultationId: r.consultation_id,
    trialSessionId: r.trial_session_id,
    versionNumber: r.version_number,
    supersedesProposalId: r.supersedes_proposal_id,
    status: r.status,
    recommendedSubjects: (r.recommended_subjects ?? []) as ProposalListItem["recommendedSubjects"],
    recommendedTeacherId: r.recommended_teacher_id,
    recommendedSessionCount: r.recommended_session_count,
    sentAt: r.sent_at,
    respondedAt: r.responded_at,
    createdAt: r.created_at,
  }));
}

export type ConsentGapItem = {
  childId: string;
  childName: string | null;
  hasDob: boolean;
  hasActiveConsent: boolean;
};

/**
 * 보호자 동의/생년월일 미비로 이용이 막힌 학생 필터 목록. R2의
 * current_account_access_allowed() 정책이 최종 방어선이며, 이 목록은 관리자가
 * "누가 왜 막혀 있는지" 한눈에 보기 위한 조회 전용 뷰다(R3 범위: 단순 필터
 * 리스트, 별도 대시보드 아님).
 */
export async function loadConsentGaps(supabase: SupabaseClient): Promise<ConsentGapItem[]> {
  const { data: students } = await supabase
    .from("profiles")
    .select("id, name, date_of_birth, role")
    .eq("role", "student");
  if (!students || students.length === 0) return [];

  const under13OrUnknown = students.filter((s) => {
    if (!s.date_of_birth) return true;
    const dob = new Date(s.date_of_birth);
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 13);
    return dob > cutoff;
  });
  if (under13OrUnknown.length === 0) return [];

  const { data: consents } = await supabase
    .from("guardian_consents")
    .select("student_id, revoked_at")
    .in(
      "student_id",
      under13OrUnknown.map((s) => s.id)
    );
  const activeConsentStudentIds = new Set(
    (consents ?? []).filter((c) => !c.revoked_at).map((c) => c.student_id)
  );

  return under13OrUnknown
    .map((s) => ({
      childId: s.id,
      childName: s.name,
      hasDob: !!s.date_of_birth,
      hasActiveConsent: activeConsentStudentIds.has(s.id),
    }))
    .filter((s) => !s.hasDob || !s.hasActiveConsent);
}

export type DriveArtifactIssue = {
  id: string;
  contractId: string;
  artifactType: string;
  syncStatus: string;
};

export async function loadDriveArtifactIssues(supabase: SupabaseClient): Promise<DriveArtifactIssue[]> {
  const { data } = await supabase
    .from("drive_artifacts")
    .select("id, contract_id, artifact_type, sync_status")
    .in("sync_status", ["retryable_failed", "manual_review"]);
  return (data ?? []).map((r) => ({
    id: r.id,
    contractId: r.contract_id,
    artifactType: r.artifact_type,
    syncStatus: r.sync_status,
  }));
}

export type StaleEnvelopeContract = {
  contractVersionId: string;
  contractId: string;
  docusignEnvelopeId: string;
  docusignEnvelopeStatus: string | null;
};

/** 발송됐지만 completed/declined/voided로 아직 마감되지 않은 envelope — 웹훅 누락 가능성 후보. */
export async function loadStaleEnvelopeVersions(
  supabase: SupabaseClient
): Promise<StaleEnvelopeContract[]> {
  const { data } = await supabase
    .from("contract_versions")
    .select("id, contract_id, docusign_envelope_id, docusign_envelope_status")
    .not("docusign_envelope_id", "is", null)
    .not("docusign_envelope_status", "in", '("completed","declined","voided")');
  return (data ?? []).map((r) => ({
    contractVersionId: r.id,
    contractId: r.contract_id,
    docusignEnvelopeId: r.docusign_envelope_id,
    docusignEnvelopeStatus: r.docusign_envelope_status,
  }));
}
