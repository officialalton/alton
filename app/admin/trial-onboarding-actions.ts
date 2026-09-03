"use server";

// M4 (1/N) — 관리자용 체험 온보딩 액션. 관리자의 outcome=trial_recommended(추천)와
// 보호자 본인의 "체험 진행 희망 확정"은 서로 다른 사건이라 confirmTrialIntent로
// 명시적으로 구분해 기록한다(전화 등 외부 채널로 확인한 결과를 관리자가 대행
// 입력하는 경우를 이번 라운드는 다룬다 — 보호자 셀프서비스 확정 화면은 범위 밖).
// 실제 이메일 발송은 하지 않는다 — raw_token을 관리자 화면에 그대로 노출해
// 로컬 검증(링크를 수동으로 열어보는 것)만 가능하게 한다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { planSubjectEnrollment, assignTeacherToSubjectEnrollment } from "./subject-enrollment-actions";
import { companySignOffContractVersion, sendContractForSignature } from "./consultation-actions";

// 기존 상담 관리 액션(app/admin/consultation-actions.ts)과 동일한 capability를
// 재사용한다 — 새 권한 이름을 따로 만들지 않는다.
const CONSULT_CAPABILITY = "manage_consultations";

export async function confirmTrialIntentAction(consultationId: string): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("confirm_trial_intent", {
    p_consultation_id: consultationId,
    p_admin_id: actorUserId,
  });
  if (error) throw new Error(error.message);
}

export async function createTrialOnboardingLinkAction(params: {
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentEmail: string;
  studentGrade?: string;
}): Promise<{ linkId: string; rawToken: string }> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_trial_onboarding_link", {
    p_consultation_id: params.consultationId,
    p_guardian_email: params.guardianEmail,
    p_guardian_name: params.guardianName,
    p_student_name: params.studentName,
    p_student_email: params.studentEmail,
    p_admin_id: actorUserId,
    p_student_grade: params.studentGrade ?? null,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("온보딩 링크 발급에 실패했습니다.");
  return { linkId: row.link_id, rawToken: row.raw_token };
}

// =========================================================================
// M4 (2/N) — 3번: 체험 예약 전 과목 수강 관계 + 선생님 배정. R5의 기존 함수를
// 그대로 재사용한다(별도 체험 배정 모델 없음) — subject_enrollment는 'planned'
// 상태로 남고(계약 active 전까지는 activateSubjectEnrollment로 활성화하지
// 않는다), teacher_assignments는 그 위에 바로 'active'로 생성 가능하다
// (assignTeacherToSubjectEnrollment는 enrollment 상태와 무관하게 동작함을
// 코드 확인 완료). "체험 예약에는 현재 배정된 선생님의 가능시간만 표시"는 R6가
// 이미 배정된 teacher_id 기준으로 가능시간을 조회하므로 별도 구현 불필요.
// =========================================================================
export async function planTrialSubjectAndAssignTeacherAction(params: {
  childId: string;
  subjectId: string;
  teacherId: string;
  effectiveFrom: string;
}): Promise<{ subjectEnrollmentId: string; teacherAssignmentId: string }> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  // draft 계약(요구사항 9의 "기존 계약 대조"와 같은 헬퍼) — 체험 단계에서는
  // 이 계약이 draft로 남아있는 것 자체가 "아직 정규 계약 아님"의 정확한 표현.
  const { data: contractId, error: contractError } = await admin.rpc("get_or_create_draft_contract_for_child", {
    p_child_id: params.childId,
  });
  if (contractError) throw new Error(contractError.message);

  const { id: subjectEnrollmentId } = await planSubjectEnrollment({
    childId: params.childId,
    subjectId: params.subjectId,
    contractId: contractId as string,
  });

  const { id: teacherAssignmentId } = await assignTeacherToSubjectEnrollment({
    subjectEnrollmentId,
    teacherId: params.teacherId,
    effectiveFrom: params.effectiveFrom,
  });

  return { subjectEnrollmentId, teacherAssignmentId };
}

// =========================================================================
// M4 (2/N) — 9번: 관리자 원클릭 정규 계약 발송. proposals를 요구하지 않고,
// 3번에서 이미 만들어둔(get_or_create_draft_contract_for_child) draft 계약을
// 그대로 재사용해 계약 버전을 만들고, 회사 선서명·DocuSign 발송까지 한
// 호출로 연속 처리한다. 중복 클릭 안전: 이미 발송된(docusign_envelope_id가
// 있는) active 버전이 있으면 그대로 반환하고 새로 만들지 않는다. 실패는
// 성공으로 표시하지 않고 재처리 가능한 상태로 남긴다(계약/버전 상태 자체가
// 재처리 판단 기준이라 별도 상태 컬럼을 추가하지 않았다).
// =========================================================================
export type SendRegularContractResult =
  | { status: "already_sent"; contractVersionId: string; envelopeId: string }
  | { status: "sent"; contractVersionId: string; envelopeId: string }
  | { status: "failed"; contractVersionId: string; error: string };

export async function sendRegularContractOneClickAction(params: {
  childId: string;
  subjectEnrollmentId: string;
  guardianEmail: string;
  guardianName: string;
  childName: string;
}): Promise<SendRegularContractResult> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  // 정규 진행 희망(8번)이 없으면 발송하지 않는다 — 별도 고객용 제안 승인
  // 단계는 없지만, 보호자의 명시적 희망 표시는 최소 전제조건으로 유지한다.
  const { data: selection, error: selectionError } = await admin
    .from("trial_regular_progress_selections")
    .select("id")
    .eq("subject_enrollment_id", params.subjectEnrollmentId)
    .maybeSingle();
  if (selectionError) throw new Error(selectionError.message);
  if (!selection) {
    throw new Error("보호자의 정규 진행 희망 표시가 아직 없습니다.");
  }

  const { data: contractId, error: contractError } = await admin.rpc("get_or_create_draft_contract_for_child", {
    p_child_id: params.childId,
  });
  if (contractError) throw new Error(contractError.message);

  // ① 기존 계약/진행중 envelope 대조.
  const { data: existingVersions, error: versionsError } = await admin
    .from("contract_versions")
    .select("id, docusign_envelope_id, docusign_envelope_status, company_signed_at")
    .eq("contract_id", contractId as string)
    .eq("version_status", "active")
    .order("version_number", { ascending: false })
    .limit(1);
  if (versionsError) throw new Error(versionsError.message);
  const existing = existingVersions?.[0];

  if (existing?.docusign_envelope_id) {
    // 이미 발송된 상태 — 중복 클릭/재시도로 새 envelope를 만들지 않는다.
    return { status: "already_sent", contractVersionId: existing.id, envelopeId: existing.docusign_envelope_id };
  }

  // ② 필요한 계약 버전 생성(없으면). proposal_id 없이 만든다(정상 흐름에서
  // proposals 불필요).
  let contractVersionId: string;
  if (existing) {
    contractVersionId = existing.id;
  } else {
    const { data: created, error: createError } = await admin
      .from("contract_versions")
      .insert({ contract_id: contractId as string, version_number: 1, price_policy_snapshot: {} })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    contractVersionId = created.id;
  }

  // ③ 회사 선서명(이미 서명됐으면 재서명하지 않는다 — 재처리 시 멱등).
  if (!existing?.company_signed_at) {
    await companySignOffContractVersion(contractVersionId);
  }

  // ④·⑤ DocuSign 발송 + 상태·외부 ID 저장. 이번 라운드는
  // DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS가 아니면 항상 실패하는 mock/비활성
  // 경로만 검증한다(lib/docusign.ts) — 실패를 성공으로 표시하지 않고, 계약은
  // 'draft'/버전은 미발송 상태로 남아 재처리 가능하다.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  try {
    const { envelopeId } = await sendContractForSignature({
      contractVersionId,
      recipientEmail: params.guardianEmail,
      recipientName: params.guardianName,
      childName: params.childName,
      webhookUrl: `${siteUrl}/api/webhooks/docusign`,
    });
    return { status: "sent", contractVersionId, envelopeId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", contractVersionId, error: message };
  }
}

// =========================================================================
// 관리자 화면 조회용 — 온보딩/전환 파이프라인 한 화면에서 보기.
// =========================================================================
export type TrialOnboardingCandidate = {
  consultationId: string;
  contactName: string;
  contactEmail: string;
  trialIntentConfirmedAt: string | null;
  childId: string | null;
};

export async function listTrialOnboardingCandidatesAction(): Promise<TrialOnboardingCandidate[]> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultations")
    .select("id, contact_name, contact_email, trial_intent_confirmed_at, child_id")
    .eq("outcome", "trial_recommended")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    consultationId: c.id,
    contactName: c.contact_name,
    contactEmail: c.contact_email,
    trialIntentConfirmedAt: c.trial_intent_confirmed_at,
    childId: c.child_id,
  }));
}

export type RegularConversionCandidate = {
  subjectEnrollmentId: string;
  childId: string;
  childName: string;
  subjectName: string | null;
  guardianEmail: string | null;
  guardianName: string | null;
  contractStatus: string | null;
};

export async function listRegularConversionCandidatesAction(): Promise<RegularConversionCandidate[]> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data: selections, error } = await admin
    .from("trial_regular_progress_selections")
    .select("subject_enrollment_id")
    .order("confirmed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (selections ?? []).map((s) => s.subject_enrollment_id);
  if (ids.length === 0) return [];

  const { data: enrollments, error: enrollError } = await admin
    .from("subject_enrollments")
    .select("id, child_id, contract_id, subject:subjects(name)")
    .in("id", ids);
  if (enrollError) throw new Error(enrollError.message);

  const childIds = Array.from(new Set((enrollments ?? []).map((e) => e.child_id)));
  const { data: children } = childIds.length
    ? await admin.from("profiles").select("id, name").in("id", childIds)
    : { data: [] as { id: string; name: string }[] };
  const childNameById = new Map((children ?? []).map((c) => [c.id, c.name]));

  const householdEntries = await Promise.all(
    (enrollments ?? []).map(async (e) => {
      const { data: hm } = await admin
        .from("household_members")
        .select("household_id")
        .eq("profile_id", e.child_id)
        .eq("role", "child")
        .maybeSingle();
      if (!hm) return { childId: e.child_id, guardianEmail: null, guardianName: null };
      const { data: guardianHm } = await admin
        .from("household_members")
        .select("profile_id")
        .eq("household_id", hm.household_id)
        .eq("role", "guardian")
        .limit(1)
        .maybeSingle();
      if (!guardianHm) return { childId: e.child_id, guardianEmail: null, guardianName: null };
      const { data: guardianProfile } = await admin
        .from("profiles")
        .select("name")
        .eq("id", guardianHm.profile_id)
        .maybeSingle();
      const { data: guardianAuth } = await admin.auth.admin.getUserById(guardianHm.profile_id);
      return {
        childId: e.child_id,
        guardianEmail: guardianAuth?.user?.email ?? null,
        guardianName: guardianProfile?.name ?? null,
      };
    })
  );
  const guardianByChildId = new Map(householdEntries.map((g) => [g.childId, g]));

  const contractIds = Array.from(new Set((enrollments ?? []).map((e) => e.contract_id)));
  const { data: contracts } = contractIds.length
    ? await admin.from("contracts").select("id, status").in("id", contractIds)
    : { data: [] as { id: string; status: string }[] };
  const contractStatusById = new Map((contracts ?? []).map((c) => [c.id, c.status]));

  return (enrollments ?? []).map((e) => {
    const subjectRel = Array.isArray(e.subject) ? e.subject[0] : e.subject;
    const guardian = guardianByChildId.get(e.child_id);
    return {
      subjectEnrollmentId: e.id,
      childId: e.child_id,
      childName: childNameById.get(e.child_id) ?? "",
      subjectName: (subjectRel as { name?: string } | null)?.name ?? null,
      guardianEmail: guardian?.guardianEmail ?? null,
      guardianName: guardian?.guardianName ?? null,
      contractStatus: contractStatusById.get(e.contract_id) ?? null,
    };
  });
}
