"use server";

import { requireAdmin, requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { createEnvelope, assertDocusignSandboxBaseUri, getEnvelopeStatus } from "@/lib/docusign";
import { renderFamilyContractHtml } from "@/lib/contracts/family-contract-template";
import { uploadArtifactToDrive } from "@/lib/drive-artifacts";

// R3: 상담(consultation) → 체험(trial) → 제안서(proposal) → 계약(contract) 최소
// 동작 흐름. 스키마 소스 오브 트루스는 supabase/migrations/20260912000000_r3_...sql.
// 실제 DocuSign 발송(sendProposalContractForSignature 내부 createEnvelope 호출)은
// 이번 태스크에서 호출하지 않는다 — 코드만 올바르게 작성해두고, 실제 발송은 사용자
// 검토 후 다음 단계에서 수행한다.

// =========================================================================
// 1. Consultation
// =========================================================================

export async function createConsultation(params: {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  studentGrade?: string;
  category?: "family" | "teacher_applicant";
  concerns?: string;
  householdId?: string;
  childId?: string;
}): Promise<{ id: string }> {
  const { adminUserId: actorUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("consultations")
    .insert({
      contact_name: params.contactName,
      contact_email: params.contactEmail,
      contact_phone: params.contactPhone ?? null,
      student_grade: params.studentGrade ?? null,
      category: params.category ?? null,
      concerns: params.concerns ?? null,
      household_id: params.householdId ?? null,
      child_id: params.childId ?? null,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function scheduleConsultation(
  consultationId: string,
  scheduledAt: string
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultations")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", consultationId);
  if (error) throw new Error(error.message);
}

export async function completeConsultation(consultationId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultations")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", consultationId);
  if (error) throw new Error(error.message);
}

/**
 * 상담 취소. 예약(reservation) 시스템 연동은 R6 범위 밖이라 실제 캘린더/예약을
 * 건드리지 않고, consultations 자체의 상태+타임스탬프 전이로만 표현한다
 * (20260914000000 추가 컬럼: cancelled_at/cancellation_reason).
 */
export async function cancelConsultation(consultationId: string, reason?: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason ?? null,
    })
    .eq("id", consultationId);
  if (error) throw new Error(error.message);
}

/** 상담 노쇼 처리(예약된 상담에 연락 두절/미참석). */
export async function markConsultationNoShow(consultationId: string, reason?: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultations")
    .update({
      status: "no_show",
      no_show_at: new Date().toISOString(),
      cancellation_reason: reason ?? null,
    })
    .eq("id", consultationId);
  if (error) throw new Error(error.message);
}

/**
 * 재예약 = 취소가 아니라 "새 scheduled_at으로 갱신"이다(정책: 예약 시스템의
 * reschedule이 아니라 consultations 레코드 자체의 단순 상태 전이). 기존
 * scheduled_at을 덮어쓰고 status를 다시 scheduled로 되돌린다 — 별도 레코드를
 * 만들지 않는다.
 */
export async function rescheduleConsultation(
  consultationId: string,
  newScheduledAt: string
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultations")
    .update({
      status: "scheduled",
      scheduled_at: newScheduledAt,
      cancelled_at: null,
      no_show_at: null,
    })
    .eq("id", consultationId);
  if (error) throw new Error(error.message);
}

/**
 * 이메일/전화 정규화 일치 기준 중복 상담 후보 조회(find_possible_duplicate_consultations,
 * 20260912000000). 자동 판정이 아니라 후보 제시만 하고, 실제 중복 확정은 관리자가
 * consultations.duplicate_of_consultation_id를 직접 채우는 별도 동작이다(이번
 * 범위에서는 후보 조회만 제공).
 */
export async function findDuplicateConsultationCandidates(params: {
  email?: string;
  phone?: string;
  excludeConsultationId?: string;
}): Promise<Array<{ id: string; contact_name: string; contact_email: string; status: string; created_at: string }>> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("find_possible_duplicate_consultations", {
    p_email: params.email ?? null,
    p_phone: params.phone ?? null,
    p_exclude_id: params.excludeConsultationId ?? null,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// =========================================================================
// 2. Trial session
// =========================================================================

export async function createTrialSessionFromConsultation(params: {
  consultationId: string;
  childId: string;
  subjectId: string;
  teacherId: string;
  scheduledAt: string;
  goal?: string;
  exceptionApprovedBy?: string;
  exceptionReason?: string;
}): Promise<{ id: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  // DB 제약(trial_sessions_one_active_per_child, partial unique index — exception이
  // 없는 한 자녀당 scheduled/completed 체험은 1개)이 최종 방어선이지만, 그 원시
  // unique violation을 그대로 노출하지 않고 미리 확인해 사용자 친화적으로 안내한다
  // (users-actions.ts의 "선생님 시급 미설정" 사전 확인과 동일한 패턴).
  if (!params.exceptionApprovedBy) {
    const { data: existingActive, error: checkError } = await admin
      .from("trial_sessions")
      .select("id")
      .eq("child_id", params.childId)
      .in("status", ["scheduled", "completed"])
      .is("exception_approved_by", null)
      .maybeSingle();
    if (checkError) throw new Error(checkError.message);
    if (existingActive) {
      throw new Error(
        "이 학생은 이미 진행 중이거나 완료된 체험 세션이 있습니다. 추가 체험이 필요하면 관리자 예외 승인(exceptionApprovedBy/exceptionReason)을 거쳐야 합니다."
      );
    }
  } else if (!params.exceptionReason) {
    throw new Error("예외 승인 시에는 사유(exceptionReason)를 함께 입력해주세요.");
  }

  const { data, error } = await admin
    .from("trial_sessions")
    .insert({
      consultation_id: params.consultationId,
      child_id: params.childId,
      subject_id: params.subjectId,
      teacher_id: params.teacherId,
      scheduled_at: params.scheduledAt,
      goal: params.goal ?? null,
      exception_approved_by: params.exceptionApprovedBy ?? null,
      exception_reason: params.exceptionReason ?? null,
    })
    .select("id")
    .single();
  if (error) {
    // 사전 확인을 통과했더라도(동시 요청 경쟁 등) DB 트리거/unique index가 최종
    // 거부할 수 있다 — 그 경우도 같은 친화적 메시지로 감싼다.
    if (error.message.includes("trial_sessions_one_active_per_child")) {
      throw new Error(
        "이 학생은 이미 진행 중이거나 완료된 체험 세션이 있습니다. 추가 체험이 필요하면 관리자 예외 승인을 거쳐야 합니다."
      );
    }
    throw new Error(error.message);
  }

  // 버그 수정(R3 E2E 작업 중 발견): consultations.household_id/child_id가 상담
  // 등록 시점에는 아직 없을 수 있다(관리자 상담 등록 폼은 이 시점엔 아직 학생이
  // 특정되지 않은 리드를 받는 화면이다). 그 상태로는 이후 제안서 수락 후
  // ContractsTab이 "계약 생성 가능" 여부를 판단할 household/child를 찾지 못해
  // 정상 흐름의 상담이어도 계약을 생성할 수 없는 막다른 상태가 됐다. 체험을
  // 만드는 시점엔 child_id가 확정되므로, 그 child가 속한 household를 조회해
  // 함께 채워 넣는다(이미 채워져 있으면 덮어써도 같은 값이라 무해하다).
  const { data: householdMember } = await admin
    .from("household_members")
    .select("household_id")
    .eq("profile_id", params.childId)
    .eq("role", "child")
    .maybeSingle();

  await admin
    .from("consultations")
    .update({
      status: "trial_planned",
      child_id: params.childId,
      household_id: householdMember?.household_id ?? null,
    })
    .eq("id", params.consultationId);

  return { id: data.id };
}

export async function completeTrialSession(params: {
  trialSessionId: string;
  resultNotes?: string;
  recommendedTeacherId?: string;
  recommendation?: string;
  payable?: boolean;
}): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: trial, error: trialError } = await admin
    .from("trial_sessions")
    .select("id, consultation_id")
    .eq("id", params.trialSessionId)
    .single();
  if (trialError) throw new Error(trialError.message);
  if (!trial) throw new Error("존재하지 않는 체험 세션입니다.");

  const { error } = await admin
    .from("trial_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result_notes: params.resultNotes ?? null,
      recommended_teacher_id: params.recommendedTeacherId ?? null,
      recommendation: params.recommendation ?? null,
      payable: params.payable ?? true,
    })
    .eq("id", params.trialSessionId);
  if (error) throw new Error(error.message);

  await admin
    .from("consultations")
    .update({ status: "trial_completed" })
    .eq("id", trial.consultation_id);
}

/**
 * 이미 존재하는 체험 세션에 관리자 예외 승인을 소급 부여한다(예: 자녀당 1회
 * 제한을 우회해야 하는 상황이 체험 생성 이후에 판명된 경우). createTrialSessionFromConsultation의
 * exceptionApprovedBy(생성 시점 예외)와는 별개로, 이미 만들어진 행을 갱신한다.
 */
export async function approveTrialException(params: {
  trialSessionId: string;
  reason: string;
}): Promise<void> {
  const { adminUserId: actorUserId } = await requireAdmin();
  if (!params.reason) throw new Error("예외 승인 사유(reason)를 입력해주세요.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("trial_sessions")
    .update({ exception_approved_by: actorUserId, exception_reason: params.reason })
    .eq("id", params.trialSessionId);
  if (error) throw new Error(error.message);
}

function isSameCalendarDayUtc(a: string, b: Date): boolean {
  const d = new Date(a);
  return (
    d.getUTCFullYear() === b.getUTCFullYear() &&
    d.getUTCMonth() === b.getUTCMonth() &&
    d.getUTCDate() === b.getUTCDate()
  );
}

/**
 * 체험 취소. 당일 취소는 확정 정책(trial_sessions 코멘트)에 따라 정산 대상에서
 * 제외한다(payable=false) — 그 외에는 payable을 그대로 true로 둔다.
 */
export async function cancelTrialSession(params: {
  trialSessionId: string;
  cancelledBy: "student" | "teacher";
  reason?: string;
}): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: trial, error: trialError } = await admin
    .from("trial_sessions")
    .select("id, scheduled_at")
    .eq("id", params.trialSessionId)
    .single();
  if (trialError) throw new Error(trialError.message);
  if (!trial) throw new Error("존재하지 않는 체험 세션입니다.");

  const sameDay = isSameCalendarDayUtc(trial.scheduled_at, new Date());
  const { error } = await admin
    .from("trial_sessions")
    .update({
      status: params.cancelledBy === "student" ? "student_cancelled" : "teacher_cancelled",
      cancellation_reason: params.reason ?? null,
      payable: sameDay ? false : true,
    })
    .eq("id", params.trialSessionId);
  if (error) throw new Error(error.message);
}

/** 체험 노쇼. 노쇼는 정의상 예정 시각이 이미 지났으므로 항상 정산 대상에서 제외한다. */
export async function markTrialNoShow(params: {
  trialSessionId: string;
  party: "student" | "teacher";
  reason?: string;
}): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("trial_sessions")
    .update({
      status: params.party === "student" ? "student_no_show" : "teacher_no_show",
      cancellation_reason: params.reason ?? null,
      payable: false,
    })
    .eq("id", params.trialSessionId);
  if (error) throw new Error(error.message);
}

// =========================================================================
// 3. Proposal
// =========================================================================

export type ProposalSubjectInput = {
  subjectId: string;
  recommendedSessionCount?: number;
  priceMinor?: number;
  currency?: string;
};

export async function createProposal(params: {
  consultationId: string;
  trialSessionId?: string;
  subjects: ProposalSubjectInput[];
  recommendedTeacherId?: string;
  recommendedSessionCount?: number;
  priceSummary?: unknown;
  supersedesProposalId?: string;
}): Promise<{ id: string }> {
  const { adminUserId: actorUserId } = await requireAdmin();
  const admin = createAdminClient();

  let versionNumber = 1;
  if (params.supersedesProposalId) {
    const { data: prev, error: prevError } = await admin
      .from("proposals")
      .select("version_number")
      .eq("id", params.supersedesProposalId)
      .single();
    if (prevError) throw new Error(prevError.message);
    versionNumber = (prev?.version_number ?? 0) + 1;
  }

  const { data, error } = await admin
    .from("proposals")
    .insert({
      consultation_id: params.consultationId,
      trial_session_id: params.trialSessionId ?? null,
      version_number: versionNumber,
      supersedes_proposal_id: params.supersedesProposalId ?? null,
      recommended_subjects: params.subjects.map((s) => ({
        subjectId: s.subjectId,
        recommendedSessionCount: s.recommendedSessionCount ?? null,
        priceMinor: s.priceMinor ?? null,
        currency: s.currency ?? "KRW",
      })),
      recommended_teacher_id: params.recommendedTeacherId ?? null,
      recommended_session_count: params.recommendedSessionCount ?? null,
      price_summary: params.priceSummary ?? null,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // proposals.recommended_subjects(jsonb)와 별개로, 20260913000000이 신설한
  // proposal_subjects(정규화 테이블)에도 같은 라인 아이템을 남긴다 — 과목별
  // 조회/집계용 보강 뷰이지 jsonb를 대체하는 것은 아니다(마이그레이션 코멘트 참고).
  if (params.subjects.length > 0) {
    const { error: subjectsError } = await admin.from("proposal_subjects").insert(
      params.subjects.map((s) => ({
        proposal_id: data.id,
        subject_id: s.subjectId,
        recommended_session_count: s.recommendedSessionCount ?? null,
        price_minor: s.priceMinor ?? null,
        currency: s.currency ?? "KRW",
      }))
    );
    if (subjectsError) throw new Error(subjectsError.message);
  }

  await admin.from("consultations").update({ status: "proposed" }).eq("id", params.consultationId);

  return { id: data.id };
}

export async function sendProposal(proposalId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (error) throw new Error(error.message);
}

export async function respondToProposal(
  proposalId: string,
  outcome: "accepted" | "rejected"
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({ status: outcome, responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (error) throw new Error(error.message);
}

// =========================================================================
// 4. Contract + envelope
// =========================================================================

export async function createContractFromProposal(params: {
  householdId: string;
  childId: string;
  proposalId: string;
}): Promise<{ contractId: string; contractVersionId: string }> {
  const { adminUserId: actorUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: proposal, error: proposalError } = await admin
    .from("proposals")
    .select("id, consultation_id, status, recommended_subjects, price_summary")
    .eq("id", params.proposalId)
    .single();
  if (proposalError) throw new Error(proposalError.message);
  if (!proposal) throw new Error("존재하지 않는 제안서입니다.");
  if (proposal.status !== "accepted") {
    throw new Error("수락된(accepted) 제안서에서만 계약을 생성할 수 있습니다.");
  }

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .insert({
      household_id: params.householdId,
      child_id: params.childId,
      status: "draft",
    })
    .select("id")
    .single();
  if (contractError) {
    if (contractError.message.includes("contracts_one_active_per_child")) {
      throw new Error("이 학생은 이미 활성(active) 계약이 있습니다. 새 계약을 만들기 전에 기존 계약을 종료해주세요.");
    }
    throw new Error(contractError.message);
  }

  // R3 교정(2026-09-13): 기본계약(contracts)에는 과목/수량/가격을 고정하지 않는다
  // — proposal_id와 추천 스냅샷(price_policy_snapshot)은 계약이 아니라 계약
  // 버전(contract_versions) 레벨에 남긴다. contract_version_subjects는 정책과
  // 충돌해 제거됐다(제안서 쪽 proposal_subjects가 정규화된 추천 라인 아이템을 담당).
  const { data: contractVersion, error: versionError } = await admin
    .from("contract_versions")
    .insert({
      contract_id: contract.id,
      version_number: 1,
      price_policy_snapshot: proposal.price_summary ?? {},
      proposal_id: params.proposalId,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  await admin.from("consultations").update({ status: "contracted" }).eq("id", proposal.consultation_id);

  return { contractId: contract.id, contractVersionId: contractVersion.id };
}

/**
 * 회사(ALTON) 측 선서명 승인. 정책: "회사 서명이 완료된 계약 버전만 보호자에게
 * 발송 가능" — sendContractForSignature는 이 함수로 company_signed_at이 채워진
 * 버전이 아니면 발송을 거부한다.
 */
export async function companySignOffContractVersion(contractVersionId: string): Promise<void> {
  const { adminUserId: actorUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("contract_versions")
    .update({ company_signed_at: new Date().toISOString(), company_signed_by: actorUserId })
    .eq("id", contractVersionId);
  if (error) throw new Error(error.message);
}

/**
 * 계약 버전을 DocuSign sandbox로 발송한다. 안전장치: DOCUSIGN_BASE_URI가 sandbox
 * (demo.docusign.net / account-d.docusign.com)로 보이지 않으면 production으로
 * 오발송하는 사고를 막기 위해 무조건 throw한다(assertDocusignSandboxBaseUri).
 * R3 교정(2026-09-13): envelope는 contracts가 아니라 contract_versions와 1:1로
 * 연결한다 — 회사 선서명(company_signed_at)이 없는 버전은 보호자에게 발송할 수
 * 없다(정책: "회사 서명이 완료된 계약 버전만 보호자에게 발송 가능").
 * 이 함수는 이번 태스크에서 호출하지 않는다 — 코드만 정확히 작성해둔다.
 */
export async function sendContractForSignature(params: {
  contractVersionId: string;
  recipientEmail: string;
  recipientName: string;
  childName: string;
  webhookUrl: string;
}): Promise<{ envelopeId: string }> {
  await requireAdmin();
  assertDocusignSandboxBaseUri();

  const admin = createAdminClient();

  const { data: version, error: versionError } = await admin
    .from("contract_versions")
    .select("id, contract_id, company_signed_at")
    .eq("id", params.contractVersionId)
    .single();
  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("존재하지 않는 계약 버전입니다.");
  if (!version.company_signed_at) {
    throw new Error("회사 선서명이 완료되지 않은 계약 버전은 보호자에게 발송할 수 없습니다. companySignOffContractVersion을 먼저 호출하세요.");
  }

  const { envelopeId } = await createEnvelope({
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    documentHtml: renderFamilyContractHtml({
      parentName: params.recipientName,
      studentName: params.childName,
    }),
    emailSubject: "Alton Education 서비스 이용 계약서",
    webhookUrl: params.webhookUrl,
  });

  const { error } = await admin
    .from("contract_versions")
    .update({
      docusign_envelope_id: envelopeId,
      docusign_envelope_status: "sent",
      docusign_status_updated_at: new Date().toISOString(),
    })
    .eq("id", params.contractVersionId);
  if (error) throw new Error(error.message);

  const { error: contractStatusError } = await admin
    .from("contracts")
    .update({ status: "sent" })
    .eq("id", version.contract_id);
  if (contractStatusError) throw new Error(contractStatusError.message);

  // 정책(20260913000000 §3 version_status 코멘트): "새 버전 서명(sent 이상 진행) 시
  // 이전 active 버전은 superseded로 처리". 최초 발송(이 계약의 유일한 버전)일 때는
  // 다른 active 버전이 없으므로 이 update는 0행에 영향을 주고 조용히 끝난다 —
  // 재발송(createNewContractVersionForResend로 만든 새 버전을 이 함수로 발송할 때)에만
  // 실제로 이전 버전을 superseded로 바꾼다.
  const { error: supersedeError } = await admin
    .from("contract_versions")
    .update({ version_status: "superseded" })
    .eq("contract_id", version.contract_id)
    .eq("version_status", "active")
    .neq("id", params.contractVersionId);
  if (supersedeError) throw new Error(supersedeError.message);

  console.info(
    JSON.stringify({
      type: "docusign_envelope_sent",
      contractVersionId: params.contractVersionId,
      contractId: version.contract_id,
      envelopeId,
      at: new Date().toISOString(),
    })
  );

  return { envelopeId };
}

/**
 * 재발송: 기존 계약 버전을 덮어쓰지 않고 새 계약 버전을 만든다(정책: "새 버전은
 * 기존 버전을 덮어쓰지 않고 생성"). 이 함수 자체는 company_signed_at을 설정하지
 * 않는다 — 재서명이 필요한 버전이므로 companySignOffContractVersion을 다시 거쳐야만
 * sendContractForSignature가 발송을 허용한다(선서명 게이트를 재발송에서도 우회하지
 * 않는다). 실제 "이전 active 버전을 superseded로" 전이는 이 함수가 아니라
 * sendContractForSignature가 이 새 버전을 발송할 때 수행한다(위 §4 정책 코멘트 —
 * "새 버전 서명(sent 이상 진행) 시" 전이).
 */
export async function createNewContractVersionForResend(params: {
  contractId: string;
  proposalId?: string;
}): Promise<{ contractVersionId: string }> {
  const { adminUserId: actorUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: latest, error: latestError } = await admin
    .from("contract_versions")
    .select("id, version_number, price_policy_snapshot, proposal_id")
    .eq("contract_id", params.contractId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (!latest) throw new Error("재발송할 기존 계약 버전이 없습니다. createContractFromProposal로 먼저 계약을 생성하세요.");

  const { data: newVersion, error: insertError } = await admin
    .from("contract_versions")
    .insert({
      contract_id: params.contractId,
      version_number: latest.version_number + 1,
      price_policy_snapshot: latest.price_policy_snapshot ?? {},
      proposal_id: params.proposalId ?? latest.proposal_id ?? null,
      created_by: actorUserId,
      // company_signed_at/by는 의도적으로 비워둔다 — 재발송도 회사 선서명을 다시
      // 거쳐야 한다(정책: "새 버전 서명... 시에는 skip 없이 signoff 게이트 유지").
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  return { contractVersionId: newVersion.id };
}

/**
 * 무효화(void): DocuSign declined 웹훅과 독립적인 관리자 수동 무효화 액션이다
 * (예: 가족이 DocuSign 서명 전에 계약 자체를 철회하는 경우). contracts.status를
 * void로 전이하고 사유/시각을 남긴다(20260915000000 void_reason/voided_at).
 */
export async function voidContractVersion(contractVersionId: string, reason: string): Promise<void> {
  await requireAdmin();
  if (!reason) throw new Error("무효화 사유(reason)를 입력해주세요.");
  const admin = createAdminClient();

  const { data: version, error: versionError } = await admin
    .from("contract_versions")
    .select("id, contract_id")
    .eq("id", contractVersionId)
    .single();
  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("존재하지 않는 계약 버전입니다.");

  const { error } = await admin
    .from("contracts")
    .update({ status: "void", void_reason: reason, voided_at: new Date().toISOString() })
    .eq("id", version.contract_id);
  if (error) throw new Error(error.message);
}

// =========================================================================
// 5. Drive 보관 재처리 + DocuSign 상태 대조
// =========================================================================

/**
 * drive_artifacts 중 재시도 대상(retryable_failed/manual_review) 행을 다시
 * 업로드 시도한다. uploadArtifactToDrive는 이번 태스크 범위에서 스텁(항상 throw)
 * 이므로, 여기서는 그 실패를 잡아 sync_status를 되돌리되 앱/웹훅을 크래시시키지
 * 않는 재처리 파이프라인의 뼈대만 구현한다 — 실제 파일 바이트를 구하는 로직
 * (DocuSign에서 재다운로드 등)은 uploadArtifactToDrive 실 구현(R4+)과 함께 온다.
 */
export async function retryFailedDriveArtifacts(): Promise<{
  attempted: number;
  stillFailing: number;
}> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("drive_artifacts")
    .select("id, contract_id, artifact_type")
    .in("sync_status", ["retryable_failed", "manual_review"]);
  if (error) throw new Error(error.message);

  let stillFailing = 0;
  for (const row of rows ?? []) {
    try {
      await uploadArtifactToDrive({
        contractId: row.contract_id,
        artifactType: row.artifact_type as "signed_document" | "certificate_of_completion",
        fileBuffer: Buffer.alloc(0),
        fileName: `${row.artifact_type}.pdf`,
      });
      await admin
        .from("drive_artifacts")
        .update({ sync_status: "succeeded", uploaded_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch (uploadError) {
      // 정책: Drive 저장 실패는 서명/계약 상태를 되돌리지 않고 sync_status만
      // 재처리 대상으로 남긴다. uploadArtifactToDrive는 스텁이라 항상 여기로
      // 떨어지는 것이 현재로선 정상 동작이다.
      stillFailing += 1;
      await admin
        .from("drive_artifacts")
        .update({ sync_status: "retryable_failed" })
        .eq("id", row.id);
      console.error(
        JSON.stringify({
          type: "drive_artifact_retry_failed",
          driveArtifactId: row.id,
          contractId: row.contract_id,
          error: uploadError instanceof Error ? uploadError.message : String(uploadError),
        })
      );
    }
  }

  return { attempted: rows?.length ?? 0, stillFailing };
}

/**
 * 관리자 수동 트리거 DocuSign 상태 대조. 웹훅이 누락됐을 수 있는 계약 버전에
 * 대해 DocuSign 쪽 실제 봉투 상태를 조회해 contract_versions에 반영한다. 테스트에서는
 * getEnvelopeStatus를 모킹해 실제 외부 호출 없이 검증한다(정책: 실 API 호출 금지).
 */
export async function reconcileDocusignStatus(contractVersionId: string): Promise<{ status: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: version, error: versionError } = await admin
    .from("contract_versions")
    .select("id, docusign_envelope_id")
    .eq("id", contractVersionId)
    .single();
  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("존재하지 않는 계약 버전입니다.");
  if (!version.docusign_envelope_id) {
    throw new Error("이 계약 버전은 아직 DocuSign에 발송되지 않았습니다(envelope 없음).");
  }

  const { status } = await getEnvelopeStatus(version.docusign_envelope_id);

  const { error } = await admin
    .from("contract_versions")
    .update({ docusign_envelope_status: status, docusign_status_updated_at: new Date().toISOString() })
    .eq("id", contractVersionId);
  if (error) throw new Error(error.message);

  return { status };
}

// =========================================================================
// 9. 학생 분류 태그(classification_tags) — legacy consult_requests.intake_type
//    고정 enum(A~E) 대체. 관리자가 스키마 변경 없이 vocabulary를 관리하는
//    확장형 태깅 구조(20260916000000). RLS도 manage_consultations capability로
//    같이 게이트돼 있다 — 이 서버 액션 레벨의 capability 체크는 앱 레이어
//    진입만 막을 뿐이며 실제 최종 방어선은 DB RLS다.
// =========================================================================

const CONSULTATIONS_CAPABILITY = "manage_consultations";

export async function createClassificationTag(params: {
  label: string;
  description?: string;
}): Promise<{ id: string }> {
  const { actorUserId } = await requireAdminOrCapability(CONSULTATIONS_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("classification_tags")
    .insert({
      label: params.label,
      description: params.description ?? null,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

/** 태그 은퇴(soft delete). 기존에 부여된 join row는 그대로 유지되고 조회 시 active=false로만 걸러진다. */
export async function retireClassificationTag(tagId: string): Promise<void> {
  await requireAdminOrCapability(CONSULTATIONS_CAPABILITY);
  const admin = createAdminClient();

  const { error } = await admin.from("classification_tags").update({ active: false }).eq("id", tagId);
  if (error) throw new Error(error.message);
}

export async function listClassificationTags(params?: {
  includeInactive?: boolean;
}): Promise<Array<{ id: string; label: string; description: string | null; active: boolean }>> {
  await requireAdminOrCapability(CONSULTATIONS_CAPABILITY);
  const admin = createAdminClient();

  let query = admin.from("classification_tags").select("id, label, description, active").order("label");
  if (!params?.includeInactive) {
    query = query.eq("active", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function tagConsultation(params: { consultationId: string; tagId: string }): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(CONSULTATIONS_CAPABILITY);
  const admin = createAdminClient();

  const { error } = await admin.from("consultation_classification_tags").insert({
    consultation_id: params.consultationId,
    tag_id: params.tagId,
    tagged_by: actorUserId,
  });
  if (error) throw new Error(error.message);
}

export async function untagConsultation(params: { consultationId: string; tagId: string }): Promise<void> {
  await requireAdminOrCapability(CONSULTATIONS_CAPABILITY);
  const admin = createAdminClient();

  const { error } = await admin
    .from("consultation_classification_tags")
    .delete()
    .eq("consultation_id", params.consultationId)
    .eq("tag_id", params.tagId);
  if (error) throw new Error(error.message);
}
