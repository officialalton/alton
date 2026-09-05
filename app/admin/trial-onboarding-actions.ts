"use server";

// M4 (1/N) — 관리자용 체험 온보딩 액션. 관리자의 outcome=trial_recommended(추천)와
// 보호자 본인의 "체험 진행 희망 확정"은 서로 다른 사건이라 confirmTrialIntent로
// 명시적으로 구분해 기록한다(전화 등 외부 채널로 확인한 결과를 관리자가 대행
// 입력하는 경우를 이번 라운드는 다룬다 — 보호자 셀프서비스 확정 화면은 범위 밖).
// 실제 이메일 발송은 하지 않는다 — raw_token을 관리자 화면에 그대로 노출해
// 로컬 검증(링크를 수동으로 열어보는 것)만 가능하게 한다.

import { createHash } from "node:crypto";
import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { planSubjectEnrollment, assignTeacherToSubjectEnrollment } from "./subject-enrollment-actions";
import { companySignOffContractVersion, sendContractForSignature } from "./consultation-actions";
import { sendEmail } from "@/lib/email";
import { currentRequestOrigin } from "@/lib/request-origin";

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
// M4 (6/N) — "체험 온보딩 안내 발송": 관리자가 체험 진행 확정 후 누르는 단일
// 버튼. 기존 SMTP 경로(lib/email.ts)로 prospect 이메일에 안내 링크를 보낸다.
// 중복 클릭 방어: 이 상담에 이미 pending 링크가 있으면 새로 만들지 않고
// 재사용하고, 그 링크가 이미 발송 완료(notice_delivery_status='sent')면
// 같은 내용을 다시 보내지 않는다(already_sent로 반환) — 링크가 만료돼
// 재발급된 경우에만(= 새 링크 row) 실제로 새 이메일을 보낸다. 발송 실패는
// 계정이 생성된 것처럼 절대 취급하지 않는다 — 계정 생성은 이 함수가 아니라
// 보호자가 링크를 열어야만 시작되는 완전히 별개의 흐름이라 실패해도 그
// 흐름에 어떤 영향도 주지 않는다.
// =========================================================================
export type SendTrialOnboardingNoticeResult =
  | { status: "sent"; linkId: string; sentAt: string; localRedeemUrl: string | null }
  | { status: "already_sent"; linkId: string; sentAt: string }
  | { status: "failed"; linkId: string; error: string };

export async function sendTrialOnboardingNoticeAction(params: {
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentEmail: string;
  studentGrade?: string;
}): Promise<SendTrialOnboardingNoticeResult> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  // 재사용 가능한 pending 링크가 이미 있는지 먼저 확인(중복 발급/중복 발송 방지).
  const { data: existingLink } = await admin
    .from("trial_onboarding_links")
    .select("id, notice_delivery_status, notice_sent_at")
    .eq("consultation_id", params.consultationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let linkId: string;
  let rawToken: string | undefined;

  if (existingLink) {
    if (existingLink.notice_delivery_status === "sent") {
      // 이미 발송 완료 — 중복 클릭/재시도로 같은 내용을 다시 보내지 않는다.
      return { status: "already_sent", linkId: existingLink.id, sentAt: existingLink.notice_sent_at! };
    }
    // 아직 한 번도 성공적으로 보내지 못한(pending 또는 failed) 링크는 raw_token을
    // 다시 알 수 없다(해시만 저장하므로) — 실제로 전달된 적 없는 토큰이므로
    // 안전하게 폐기(revoked)하고 같은 상담에 새 링크를 발급해 그 토큰으로
    // 보낸다. 이미 유효한 링크가 보호자에게 전달된 뒤라면 이 분기를 타지
        // 않는다(성공 전송 시 위에서 이미 반환).
    await admin.from("trial_onboarding_links").update({ status: "revoked" }).eq("id", existingLink.id);
    await admin
      .from("trial_onboarding_link_events")
      .insert({ link_id: existingLink.id, event_type: "revoked", actor_id: actorUserId, detail: { reason: "미발송 링크 재발급" } });

    const { data, error } = await admin.rpc("create_trial_onboarding_link", {
      p_consultation_id: params.consultationId,
      p_guardian_email: params.guardianEmail,
      p_guardian_name: params.guardianName,
      p_student_name: params.studentName,
      p_student_email: params.studentEmail,
      p_admin_id: actorUserId,
      p_student_grade: params.studentGrade ?? null,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "온보딩 링크 재발급에 실패했습니다.");
    linkId = data[0].link_id;
    rawToken = data[0].raw_token;
  } else {
    const { data, error } = await admin.rpc("create_trial_onboarding_link", {
      p_consultation_id: params.consultationId,
      p_guardian_email: params.guardianEmail,
      p_guardian_name: params.guardianName,
      p_student_name: params.studentName,
      p_student_email: params.studentEmail,
      p_admin_id: actorUserId,
      p_student_grade: params.studentGrade ?? null,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "온보딩 링크 발급에 실패했습니다.");
    linkId = data[0].link_id;
    rawToken = data[0].raw_token;
  }

  if (!rawToken) {
    return { status: "failed", linkId, error: "재발송에 필요한 링크 토큰을 확인할 수 없습니다. 관리자 재발급이 필요합니다." };
  }

  const origin = await currentRequestOrigin();
  const redeemUrl = `${origin}/api/trial-onboarding/redeem?token=${encodeURIComponent(rawToken)}`;
  const html = `
    <p>안녕하세요, ${params.guardianName}님.</p>
    <p>${params.studentName} 학생의 체험 수업 준비를 위해 아래 링크에서 계정을 만들어주세요.</p>
    <p><a href="${redeemUrl}">${redeemUrl}</a></p>
    <p>이 링크는 72시간 동안 유효합니다.</p>
  `;
  const contentHash = createHash("sha256").update(html).digest("hex");
  const nowIso = new Date().toISOString();

  try {
    await sendEmail({ to: params.guardianEmail, subject: "[Alton Education] 체험 수업 온보딩 안내", html });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("trial_onboarding_links")
      .update({ notice_delivery_status: "failed", notice_send_error: message })
      .eq("id", linkId);
    await admin
      .from("trial_onboarding_link_events")
      .insert({ link_id: linkId, event_type: "notice_failed", actor_id: actorUserId, detail: { error: message } });
    return { status: "failed", linkId, error: message };
  }

  await admin
    .from("trial_onboarding_links")
    .update({ notice_delivery_status: "sent", notice_sent_at: nowIso, notice_content_hash: contentHash, notice_send_error: null })
    .eq("id", linkId);
  await admin
    .from("trial_onboarding_link_events")
    .insert({ link_id: linkId, event_type: "notice_sent", actor_id: actorUserId, detail: { guardian_email: params.guardianEmail } });

  // 개발 환경에서만 링크를 화면에 그대로 노출해 Mailpit 없이도 빠르게 확인할
  // 수 있게 한다 — 운영/Preview에서는 이 값을 반환하지 않는다(관리자가 전체
  // 토큰을 복사해 전달하는 방식에 의존하지 않기 위함, 실제 전달 경로는 이메일).
  const localRedeemUrl = process.env.NODE_ENV !== "production" ? redeemUrl : null;

  return { status: "sent", linkId, sentAt: nowIso, localRedeemUrl };
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
  // 온보딩 링크의 최신 상태 — "발급한 적 없음"과 "발급했지만 아직 대기/만료/
  // 사용완료"를 구분해서 보여주기 위함(요구사항: 온보딩 링크 상태 구분).
  linkStatus: "none" | "pending" | "redeemed" | "expired" | "revoked";
};

// UI 폴리싱 — 관리자 화면에 14단계 파이프라인 상태를 한 번에 보여주기 위한
// 단계별 완료 여부. 새 정책·새 상태값을 만들지 않고 기존 테이블에 이미 있는
// 값만 조회해서 표시용으로 조합한다(체험/정규 배정은 여전히 단일
// teacher_assignments라는 정책 그대로 — "배정" 한 단계로만 표시).
export type TrialPipelineStepKey =
  | "trial_intent"
  | "account_linked"
  | "assignment"
  | "trial_consent"
  | "trial_entitlement"
  | "trial_booking"
  | "smart_notes"
  | "review"
  | "regular_intent"
  | "contract_sent"
  | "signed"
  | "purchase"
  | "subject_active";

export type TrialPipelineStep = { key: TrialPipelineStepKey; done: boolean; label: string };

export type TrialOnboardingPipeline = {
  consultationId: string;
  subjectEnrollmentId: string | null;
  steps: TrialPipelineStep[];
  trialEntitlementGrantStatus: string | null;
  trialEntitlementGrantError: string | null;
};

const PIPELINE_STEP_LABELS: Record<TrialPipelineStepKey, string> = {
  trial_intent: "체험 희망 확정",
  account_linked: "보호자·학생 계정 연결",
  assignment: "과목·선생님 배정",
  trial_consent: "체험 Smart Notes 동의",
  trial_entitlement: "체험수업권 지급",
  trial_booking: "체험 예약",
  smart_notes: "Smart Notes 연결",
  review: "선생님 리뷰 확정",
  regular_intent: "정규 진행 희망",
  contract_sent: "계약 발송",
  signed: "보호자 서명",
  purchase: "정규상품 구매",
  subject_active: "과목 활성화",
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

  const consultationIds = (data ?? []).map((c) => c.id);
  const { data: links } = consultationIds.length
    ? await admin
        .from("trial_onboarding_links")
        .select("consultation_id, status, created_at")
        .in("consultation_id", consultationIds)
        .order("created_at", { ascending: false })
    : { data: [] as { consultation_id: string; status: string; created_at: string }[] };
  const latestLinkStatusByConsultation = new Map<string, string>();
  for (const l of links ?? []) {
    if (!latestLinkStatusByConsultation.has(l.consultation_id)) {
      latestLinkStatusByConsultation.set(l.consultation_id, l.status);
    }
  }

  return (data ?? []).map((c) => ({
    consultationId: c.id,
    contactName: c.contact_name,
    contactEmail: c.contact_email,
    trialIntentConfirmedAt: c.trial_intent_confirmed_at,
    childId: c.child_id,
    linkStatus: (latestLinkStatusByConsultation.get(c.id) as TrialOnboardingCandidate["linkStatus"]) ?? "none",
  }));
}

export async function getTrialOnboardingPipelineAction(
  consultationId: string,
  childId: string | null,
  trialIntentConfirmedAt: string | null
): Promise<TrialOnboardingPipeline> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: consultationRow } = await admin
    .from("consultations")
    .select("trial_entitlement_grant_status, trial_entitlement_grant_error")
    .eq("id", consultationId)
    .maybeSingle();

  const done: Partial<Record<TrialPipelineStepKey, boolean>> = {
    trial_intent: !!trialIntentConfirmedAt,
    account_linked: !!childId,
  };
  let subjectEnrollmentId: string | null = null;

  if (childId) {
    const { data: enrollment } = await admin
      .from("subject_enrollments")
      .select("id, status")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    subjectEnrollmentId = enrollment?.id ?? null;
    done.assignment = false;
    done.subject_active = enrollment?.status === "active";

    if (subjectEnrollmentId) {
      const { data: assignment } = await admin
        .from("teacher_assignments")
        .select("id")
        .eq("subject_enrollment_id", subjectEnrollmentId)
        .eq("status", "active")
        .maybeSingle();
      done.assignment = !!assignment;
    }

    const { data: consent } = await admin
      .from("trial_smart_notes_consents")
      .select("id")
      .eq("child_id", childId)
      .maybeSingle();
    done.trial_consent = !!consent;

    const { data: grant } = await admin
      .from("entitlement_grants")
      .select("id, entitlement_products!inner(code)")
      .eq("child_id", childId)
      .eq("entitlement_products.code", "trial_lesson_grant")
      .maybeSingle();
    done.trial_entitlement = !!grant;

    if (subjectEnrollmentId) {
      const { data: trialSession } = await admin
        .from("sessions")
        .select("id, smart_notes_status")
        .eq("subject_enrollment_id", subjectEnrollmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      done.trial_booking = !!trialSession;
      // "applied"는 sessions.smart_notes_status의 유효한 값이 아니다(체크 제약:
      // not_applicable/pending/active/completed/failed) — 원본이 실제로 연결돼도
      // 이 비교가 항상 false였다(2026-09-05 실사용 발견, 웹훅 쪽도 함께 수정).
      done.smart_notes = trialSession?.smart_notes_status === "completed";

      const { data: review } = await admin
        .from("trial_lesson_reviews")
        .select("id")
        .eq("subject_enrollment_id", subjectEnrollmentId)
        .eq("status", "final")
        .maybeSingle();
      done.review = !!review;

      const { data: selection } = await admin
        .from("trial_regular_progress_selections")
        .select("id")
        .eq("subject_enrollment_id", subjectEnrollmentId)
        .maybeSingle();
      done.regular_intent = !!selection;
    }

    const { data: contract } = await admin
      .from("contracts")
      .select("id, status")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contract) {
      const { data: version } = await admin
        .from("contract_versions")
        .select("docusign_envelope_id")
        .eq("contract_id", contract.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      done.contract_sent = !!version?.docusign_envelope_id;
      done.signed = contract.status === "active";

      const { data: purchase } = await admin
        .from("purchases")
        .select("id")
        .eq("contract_id", contract.id)
        .eq("status", "succeeded")
        .limit(1)
        .maybeSingle();
      done.purchase = !!purchase;
    }
  }

  const order: TrialPipelineStepKey[] = [
    "trial_intent",
    "account_linked",
    "assignment",
    "trial_consent",
    "trial_entitlement",
    "trial_booking",
    "smart_notes",
    "review",
    "regular_intent",
    "contract_sent",
    "signed",
    "purchase",
    "subject_active",
  ];

  return {
    consultationId,
    subjectEnrollmentId,
    trialEntitlementGrantStatus: consultationRow?.trial_entitlement_grant_status ?? null,
    trialEntitlementGrantError: consultationRow?.trial_entitlement_grant_error ?? null,
    steps: order.map((key) => ({ key, done: !!done[key], label: PIPELINE_STEP_LABELS[key] })),
  };
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
