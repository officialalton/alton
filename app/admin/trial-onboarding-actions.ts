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
import { recordOrGetCompanyApproval } from "@/lib/contract-company-approval";
import { sendEmail, escapeHtml } from "@/lib/email";
import { currentRequestOrigin } from "@/lib/request-origin";
import { appendVercelProtectionBypass } from "@/lib/vercel-protection-bypass";

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
//
// 2026-09-06(제품 오너 최종 확정) — 학생은 1~N명 배열로 입력받는다. 가족당
// 온보딩 이메일/링크는 여전히 1개만 발송한다(학생 수와 무관).
// =========================================================================
export type SendTrialOnboardingNoticeResult =
  | { status: "sent"; linkId: string; sentAt: string; localRedeemUrl: string | null }
  | { status: "already_sent"; linkId: string; sentAt: string }
  | { status: "failed"; linkId: string; error: string };

export type TrialOnboardingStudentInput = {
  name: string;
  email: string;
  grade?: string;
  subject?: string;
};

// 과도한 이메일 검증 라이브러리 없이 형식 오류만 걸러내는 최소 정규식 —
// RFC 완전 준수가 목적이 아니라 "빈 문자열"·"@ 없음" 같은 명백한 오입력을
// 클라이언트 검증 우회(직접 서버 액션 호출)로부터도 막는 것이 목적이다.
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertTrialOnboardingNoticeParamsValid(params: {
  guardianEmail: string;
  guardianName: string;
  students: TrialOnboardingStudentInput[];
}): void {
  if (!params.guardianName.trim()) throw new Error("보호자 이름을 입력해주세요.");
  if (!params.guardianEmail.trim() || !SIMPLE_EMAIL_RE.test(params.guardianEmail.trim())) {
    throw new Error("보호자 이메일 형식이 올바르지 않습니다.");
  }
  if (!params.students.length) throw new Error("학생을 최소 1명 입력해주세요.");
  const seen = new Set<string>();
  for (const s of params.students) {
    if (!s.name.trim()) throw new Error("학생 이름을 입력해주세요.");
    if (!s.email.trim() || !SIMPLE_EMAIL_RE.test(s.email.trim())) {
      throw new Error("학생 이메일 형식이 올바르지 않습니다.");
    }
    const norm = s.email.trim().toLowerCase();
    if (seen.has(norm)) throw new Error(`같은 이메일이 중복 입력됐습니다: ${s.email}`);
    seen.add(norm);
  }
}

export async function sendTrialOnboardingNoticeAction(params: {
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  students: TrialOnboardingStudentInput[];
  // 2026-09-06(실제 버그 수정 — matchbox512@snu.ac.kr 상담건) — 이미 발송
  // 완료(notice_delivery_status='sent')된 링크가 있으면 원래는 무조건
  // "already_sent"로 막는다(중복 발송 방지). 하지만 그 링크로 보호자가 실제
  // 계정 생성에 계속 실패하는 경우(예: 좀비 auth.identities 충돌), 관리자가
  // 원인을 인지하고 명시적으로 "이 링크 폐기하고 새로 발급"을 선택할 수
  // 있어야 한다 — forceReissue=true면 이미 발송된 링크라도 revoked 처리하고
  // 새 링크를 발급·발송한다.
  forceReissue?: boolean;
}): Promise<SendTrialOnboardingNoticeResult> {
  // 2026-09-06(#441 마스킹 버그 수정) — workspace-actions.ts의 기존 실측
  // 확인 사례(2026-09-01)와 동일한 원인: 이 함수 안에서 던져진 에러(검증
  // 실패·RPC 에러 등)가 그대로 propagate되면, Next.js가 production에서
  // Server Action의 미처리 예외를 일반화된 "Minified React error #441"
  // 메시지로 마스킹해 클라이언트에 전달한다(실제 원인 메시지가 사라짐).
  // sendEmail() 실패만 개별적으로 잡던 기존 코드는 검증 실패나 RPC 에러
  // 같은 다른 실패 경로를 놓쳤다 — 함수 전체를 감싸 항상 { status: "failed" }
  // 형태로 반환한다(Next.js 공식 권장 패턴, 예외를 던지지 않음).
  try {
    return await sendTrialOnboardingNoticeInternal(params);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", linkId: "", error: message };
  }
}

async function sendTrialOnboardingNoticeInternal(params: {
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  students: TrialOnboardingStudentInput[];
  forceReissue?: boolean;
}): Promise<SendTrialOnboardingNoticeResult> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  assertTrialOnboardingNoticeParamsValid(params);
  const admin = createAdminClient();

  // 2026-09-06(실제 버그 수정) — assertTrialOnboardingNoticeParamsValid()는
  // params.guardianEmail.trim()으로 형식만 검증하고, 정작 저장/RPC 전달에는
  // trim되지 않은 원본 params.guardianEmail을 그대로 써왔다. 관리자가 이메일을
  // 복사·붙여넣기하며 앞뒤 공백이 섞이면(흔한 실수) 검증은 통과하지만, 이후
  // 보호자가 온보딩 링크를 열었을 때 lib/trial-onboarding-finalize.ts가 그
  // 공백 섞인 이메일 그대로 admin.auth.admin.createUser()를 호출해 GoTrue가
  // "Unable to validate email address: invalid format"로 거부한다 — 그 결과가
  // "보호자 계정 생성에 실패했습니다" 에러로 /login에 표시됐다(제품 오너가
  // Preview에서 실측 재현, node repro 스크립트로 GoTrue 400 응답 직접 확인).
  // 검증에 쓴 것과 동일하게 trim된 값을 이후 모든 사용처(RPC 저장, 이메일
  // 발송, 이벤트 로그)에 일관되게 쓴다.
  params = { ...params, guardianEmail: params.guardianEmail.trim() };

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

  const studentsPayload = params.students.map((s) => ({
    name: s.name.trim(),
    email: s.email.trim(),
    grade: s.grade?.trim() || null,
    subject: s.subject?.trim() || null,
  }));

  if (existingLink) {
    if (existingLink.notice_delivery_status === "sent" && !params.forceReissue) {
      // 이미 발송 완료 — 중복 클릭/재시도로 같은 내용을 다시 보내지 않는다.
      // (관리자가 이 링크가 실제로는 계속 실패하고 있다는 걸 확인했다면
      // forceReissue=true로 명시적 재발급을 요청할 수 있다 — 위 주석 참고.)
      return { status: "already_sent", linkId: existingLink.id, sentAt: existingLink.notice_sent_at! };
    }
    // 아직 한 번도 성공적으로 보내지 못한(pending 또는 failed) 링크이거나,
    // 관리자가 명시적으로 재발급(forceReissue)을 요청한 경우 — 기존 링크를
    // 안전하게 폐기(revoked)하고 같은 상담에 새 링크를 발급해 그 토큰으로
    // 보낸다.
    await admin.from("trial_onboarding_links").update({ status: "revoked" }).eq("id", existingLink.id);
    await admin.from("trial_onboarding_link_events").insert({
      link_id: existingLink.id,
      event_type: "revoked",
      actor_id: actorUserId,
      detail: { reason: params.forceReissue ? "관리자 강제 재발급" : "미발송 링크 재발급" },
    });

    const { data, error } = await admin.rpc("create_trial_onboarding_link_multi", {
      p_consultation_id: params.consultationId,
      p_guardian_email: params.guardianEmail,
      p_guardian_name: params.guardianName,
      p_students: studentsPayload,
      p_admin_id: actorUserId,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "온보딩 링크 재발급에 실패했습니다.");
    linkId = data[0].link_id;
    rawToken = data[0].raw_token;
  } else {
    const { data, error } = await admin.rpc("create_trial_onboarding_link_multi", {
      p_consultation_id: params.consultationId,
      p_guardian_email: params.guardianEmail,
      p_guardian_name: params.guardianName,
      p_students: studentsPayload,
      p_admin_id: actorUserId,
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
  const studentNamesLabel = studentsPayload.map((s) => escapeHtml(s.name)).join(", ");
  const html = `
    <p>안녕하세요, ${escapeHtml(params.guardianName)}님.</p>
    <p>${studentNamesLabel} 학생의 체험 수업 준비를 위해 아래 링크에서 계정을 만들어주세요.</p>
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
}): Promise<{ subjectEnrollmentId: string; teacherAssignmentId: string; activationWarning: string | null }> {
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

  const { id: teacherAssignmentId, activationWarning } = await assignTeacherToSubjectEnrollment({
    subjectEnrollmentId,
    teacherId: params.teacherId,
    effectiveFrom: params.effectiveFrom,
  });

  return { subjectEnrollmentId, teacherAssignmentId, activationWarning };
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
  approverTitle: string;
}): Promise<SendRegularContractResult> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
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

  // ③ 회사 전자승인(이미 승인됐으면 재승인하지 않는다 — 재처리 시 멱등). 게이트
  // 플래그(company_signed_at)와 별개로, 승인자·직함·계약 주체·문서 식별값은
  // recordOrGetCompanyApproval이 변경 불가능한 감사 이력에 남긴다 — 이미 있으면
  // 그 값을 그대로 재사용해 문서를 만든다(중복 클릭해도 승인 내용이 바뀌지 않음).
  if (!existing?.company_signed_at) {
    await companySignOffContractVersion(contractVersionId);
  }
  const { data: approverProfile, error: approverProfileError } = await admin
    .from("profiles")
    .select("name")
    .eq("id", actorUserId)
    .single();
  if (approverProfileError) throw new Error(approverProfileError.message);
  const companyApproval = await recordOrGetCompanyApproval(admin, {
    contractVersionId,
    approvedByUserId: actorUserId,
    approverName: approverProfile?.name ?? "[관리자 이름 미등록]",
    approverTitle: params.approverTitle,
  });

  // ④·⑤ 회사 전자승인이 삽입된 문서로 DocuSign 발송 + 상태·외부 ID 저장.
  // 이번 라운드는 DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS가 아니면 항상 실패하는
  // mock/비활성 경로만 검증한다(lib/docusign.ts) — 실패를 성공으로 표시하지
  // 않고, 계약은 'draft'/버전은 미발송 상태로 남아 재처리 가능하다. 승인
  // 감사 행은 이미 위에서 기록됐으므로 재시도해도 다시 기록되지 않는다.
  const siteUrl = await currentRequestOrigin();
  try {
    const { envelopeId } = await sendContractForSignature({
      contractVersionId,
      recipientEmail: params.guardianEmail,
      recipientName: params.guardianName,
      childName: params.childName,
      webhookUrl: appendVercelProtectionBypass(`${siteUrl}/api/webhooks/docusign`),
      companyApproval,
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
  // 2026-09-06(복수 자녀 온보딩) — 계정 생성이 완료된 학생별로 한 행씩 생성된다
  // (단일 칸반 유지, 학생별 진행 카드). familyLinkId/studentName은 형제자매를
  // 함께 찾기 위한 배지 표시용이다. 학생 계정이 아직 하나도 생성되지 않은
  // 상담은 기존과 동일하게 상담 건 자체를 대표하는 행 1개만 반환된다.
  familyLinkId?: string | null;
  studentName?: string | null;
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
        .select("id, consultation_id, status, created_at")
        .in("consultation_id", consultationIds)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; consultation_id: string; status: string; created_at: string }[] };
  const latestLinkStatusByConsultation = new Map<string, string>();
  const latestLinkIdByConsultation = new Map<string, string>();
  for (const l of links ?? []) {
    if (!latestLinkStatusByConsultation.has(l.consultation_id)) {
      latestLinkStatusByConsultation.set(l.consultation_id, l.status);
      latestLinkIdByConsultation.set(l.consultation_id, l.id);
    }
  }

  // 계정 생성이 완료된(status='created') 학생 명단 — 최신 링크 기준으로만
  // 형제자매 카드를 만든다(이전에 revoked된 링크의 학생은 표시하지 않음).
  const latestLinkIds = Array.from(latestLinkIdByConsultation.values());
  const { data: createdStudents } = latestLinkIds.length
    ? await admin
        .from("trial_onboarding_link_students")
        .select("link_id, student_name, child_auth_user_id")
        .in("link_id", latestLinkIds)
        .eq("status", "created")
        .order("created_at", { ascending: true })
    : { data: [] as { link_id: string; student_name: string; child_auth_user_id: string | null }[] };
  const linkIdToConsultationId = new Map<string, string>();
  for (const [cId, lId] of latestLinkIdByConsultation.entries()) linkIdToConsultationId.set(lId, cId);
  const createdStudentsByConsultation = new Map<string, { studentName: string; childId: string; linkId: string }[]>();
  for (const s of createdStudents ?? []) {
    if (!s.child_auth_user_id) continue;
    const consultationId = linkIdToConsultationId.get(s.link_id);
    if (!consultationId) continue;
    const list = createdStudentsByConsultation.get(consultationId) ?? [];
    list.push({ studentName: s.student_name, childId: s.child_auth_user_id, linkId: s.link_id });
    createdStudentsByConsultation.set(consultationId, list);
  }

  return (data ?? []).flatMap((c): TrialOnboardingCandidate[] => {
    const created = createdStudentsByConsultation.get(c.id);
    if (created && created.length) {
      return created.map((s) => ({
        consultationId: c.id,
        contactName: c.contact_name,
        contactEmail: c.contact_email,
        trialIntentConfirmedAt: c.trial_intent_confirmed_at,
        childId: s.childId,
        linkStatus: (latestLinkStatusByConsultation.get(c.id) as TrialOnboardingCandidate["linkStatus"]) ?? "none",
        familyLinkId: s.linkId,
        studentName: s.studentName,
      }));
    }
    return [
      {
        consultationId: c.id,
        contactName: c.contact_name,
        contactEmail: c.contact_email,
        trialIntentConfirmedAt: c.trial_intent_confirmed_at,
        childId: c.child_id,
        linkStatus: (latestLinkStatusByConsultation.get(c.id) as TrialOnboardingCandidate["linkStatus"]) ?? "none",
        familyLinkId: latestLinkIdByConsultation.get(c.id) ?? null,
        studentName: null,
      },
    ];
  });
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
        .from("lesson_reviews")
        .select("id")
        .eq("subject_enrollment_id", subjectEnrollmentId)
        .eq("lesson_type", "trial")
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
  contractId: string;
  childName: string;
  subjectName: string | null;
  guardianEmail: string | null;
  guardianName: string | null;
  contractStatus: string | null;
  // contracts.status는 계약 전체 상태라 새 버전(재발송)이 아직 미발송이어도
  // 이전 버전이 완료됐으면 'active'로 남아있다 — "이미 발송됨" 표시는 반드시
  // 최신 active 버전 자체에 envelope가 있는지로 판단해야 한다(실사용 확인:
  // v2를 만들었는데도 버튼이 계속 "발송 완료"로 비활성화되던 버그).
  latestVersionHasEnvelope: boolean;
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

  // 계약당 최신 active 버전 하나만 필요 — 여러 버전이 있어도 발송 대상은
  // 항상 이 최신 버전이다(sendRegularContractOneClickAction과 동일 조건).
  const { data: latestVersions } = contractIds.length
    ? await admin
        .from("contract_versions")
        .select("contract_id, version_number, docusign_envelope_id")
        .in("contract_id", contractIds)
        .eq("version_status", "active")
        .order("version_number", { ascending: false })
    : { data: [] as { contract_id: string; version_number: number; docusign_envelope_id: string | null }[] };
  const latestVersionHasEnvelopeByContractId = new Map<string, boolean>();
  for (const v of latestVersions ?? []) {
    if (!latestVersionHasEnvelopeByContractId.has(v.contract_id)) {
      latestVersionHasEnvelopeByContractId.set(v.contract_id, !!v.docusign_envelope_id);
    }
  }

  return (enrollments ?? []).map((e) => {
    const subjectRel = Array.isArray(e.subject) ? e.subject[0] : e.subject;
    const guardian = guardianByChildId.get(e.child_id);
    return {
      subjectEnrollmentId: e.id,
      childId: e.child_id,
      contractId: e.contract_id,
      childName: childNameById.get(e.child_id) ?? "",
      subjectName: (subjectRel as { name?: string } | null)?.name ?? null,
      guardianEmail: guardian?.guardianEmail ?? null,
      guardianName: guardian?.guardianName ?? null,
      contractStatus: contractStatusById.get(e.contract_id) ?? null,
      latestVersionHasEnvelope: latestVersionHasEnvelopeByContractId.get(e.contract_id) ?? false,
    };
  });
}

// =========================================================================
// 2026-09-06(복수 자녀 온보딩) — 학생 명단 조회 + 실패한 학생 1명만 재시도.
// 형제자매를 롤백하지 않고 실패한 학생만 개별 재시도할 수 있어야 한다는
// 요구사항을 관리자 화면에서 실행하기 위한 액션.
// =========================================================================
export type TrialOnboardingLinkStudent = {
  id: string;
  studentName: string;
  studentEmail: string;
  studentGrade: string | null;
  studentSubject: string | null;
  status: "pending" | "created" | "failed";
  childAuthUserId: string | null;
  error: string | null;
};

// 2026-09-06(발송 상태 조회 화면) — 제품 오너 지적: "메일을 보낸 상태에서 해당
// 상담건의 부모님/자녀 이메일 등에 대한 입력을 어떻게 했는지, 부모가 동의하고
// 계정 만들기 전 상태에 대해 확인하기 어렵다"를 고친다. 링크 자체(보낸 시각,
// 보호자 이름/이메일, 링크 상태·실패 사유)를 조회하는 액션 — 학생별 정보는
// 기존 listTrialOnboardingLinkStudentsAction()을 그대로 함께 쓴다.
export type TrialOnboardingLinkDetail = {
  linkId: string;
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  status: "pending" | "redeemed" | "expired" | "revoked";
  noticeDeliveryStatus: "pending" | "sent" | "failed";
  noticeSentAt: string | null;
  noticeSendError: string | null;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
};

export async function getTrialOnboardingLinkDetailAction(linkId: string): Promise<TrialOnboardingLinkDetail> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("trial_onboarding_links")
    .select(
      "id, consultation_id, guardian_email, guardian_name, status, notice_delivery_status, notice_sent_at, notice_send_error, created_at, expires_at, redeemed_at"
    )
    .eq("id", linkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("존재하지 않는 온보딩 링크입니다.");
  return {
    linkId: data.id,
    consultationId: data.consultation_id,
    guardianEmail: data.guardian_email,
    guardianName: data.guardian_name,
    status: data.status as TrialOnboardingLinkDetail["status"],
    noticeDeliveryStatus: data.notice_delivery_status as TrialOnboardingLinkDetail["noticeDeliveryStatus"],
    noticeSentAt: data.notice_sent_at,
    noticeSendError: data.notice_send_error,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    redeemedAt: data.redeemed_at,
  };
}

// 2026-09-06(실제 버그 수정 — matchbox512@snu.ac.kr 상담건) — 관리자가 발송
// 내역 화면에서 "이미 보냈는데 계속 실패한다"고 판단했을 때 누르는 명시적
// 재발급 액션. 기존 링크를 폐기하고 같은 학생 명단으로 새 링크를 발급·재발송한다
// (forceReissue=true로 sendTrialOnboardingNoticeInternal의 already_sent
// 단락을 우회). 아직 한 번도 redeem되지 않은(status='pending', redeemed_at
// null) 링크에만 허용한다 — 이미 redeem된 링크를 폐기하면 진행 중인 계정
// 생성/자녀 연결 흐름을 끊어버릴 수 있다.
// 2026-09-06(UAT 지적) — 재발급 시 기존 이메일 그대로만 쓸 수 있어, 관리자가
// 오타를 고치거나(가장 흔한 재발급 사유가 이메일 오타 자체인데 그걸 못 고침)
// 실제 다른 이메일을 새로 입력해야 하는 경우 대응이 불가능했다. overrides로
// 보호자·학생 이메일(및 이름)을 재발급 시점에 새로 입력할 수 있게 한다 —
// 넘기지 않으면 기존 값을 그대로 쓴다(하위 호환).
export async function reissueTrialOnboardingLinkAction(
  linkId: string,
  overrides?: {
    guardianEmail?: string;
    guardianName?: string;
    students?: { name: string; email: string; grade?: string; subject?: string }[];
  }
): Promise<SendTrialOnboardingNoticeResult> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("id, consultation_id, guardian_email, guardian_name, status, redeemed_at")
    .eq("id", linkId)
    .maybeSingle();
  if (linkError) throw new Error(linkError.message);
  if (!link) throw new Error("존재하지 않는 온보딩 링크입니다.");
  if (link.status !== "pending" || link.redeemed_at) {
    throw new Error("이미 보호자가 확인했거나 취소/만료된 링크는 재발급할 수 없습니다.");
  }
  const { data: students, error: studentsError } = await admin
    .from("trial_onboarding_link_students")
    .select("student_name, student_email, student_grade, student_subject")
    .eq("link_id", linkId)
    .order("created_at", { ascending: true });
  if (studentsError) throw new Error(studentsError.message);
  if (!students?.length) throw new Error("학생 명단을 찾을 수 없어 재발급할 수 없습니다.");

  const guardianEmail = overrides?.guardianEmail?.trim() || link.guardian_email;
  const guardianName = overrides?.guardianName?.trim() || link.guardian_name;
  const studentsPayload =
    overrides?.students && overrides.students.length === students.length
      ? overrides.students.map((s, i) => ({
          name: s.name.trim() || students[i].student_name,
          email: s.email.trim() || students[i].student_email,
          grade: s.grade ?? students[i].student_grade ?? undefined,
          subject: s.subject ?? students[i].student_subject ?? undefined,
        }))
      : students.map((s) => ({
          name: s.student_name,
          email: s.student_email,
          grade: s.student_grade ?? undefined,
          subject: s.student_subject ?? undefined,
        }));

  return sendTrialOnboardingNoticeAction({
    consultationId: link.consultation_id,
    guardianEmail,
    guardianName,
    students: studentsPayload,
    forceReissue: true,
  });
}

export async function listTrialOnboardingLinkStudentsAction(linkId: string): Promise<TrialOnboardingLinkStudent[]> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("trial_onboarding_link_students")
    .select("id, student_name, student_email, student_grade, student_subject, status, child_auth_user_id, error")
    .eq("link_id", linkId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    studentName: s.student_name,
    studentEmail: s.student_email,
    studentGrade: s.student_grade,
    studentSubject: s.student_subject,
    status: s.status as TrialOnboardingLinkStudent["status"],
    childAuthUserId: s.child_auth_user_id,
    error: s.error,
  }));
}

export type RetryTrialOnboardingStudentResult =
  | { status: "created"; childId: string }
  | { status: "failed"; error: string };

// 실패한 학생 1명만 재시도 — 이미 만들어진 형제자매/household는 건드리지
// 않는다. 이전 시도에서 이미 Auth 계정이 생겼다면(예: DB finalize 단계에서만
// 실패) 그 계정을 재사용하고, 없으면 새로 만든다 — 중복 Auth 계정 생성을
// 피하기 위해 이메일로 기존 계정 여부를 먼저 확인한다.
export async function retryFailedTrialOnboardingStudentAction(
  linkId: string,
  linkStudentId: string
): Promise<RetryTrialOnboardingStudentResult> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("trial_onboarding_link_students")
    .select("student_name, student_email, student_grade, status, child_auth_user_id")
    .eq("id", linkStudentId)
    .eq("link_id", linkId)
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) throw new Error("존재하지 않는 학생 항목입니다.");
  if (student.status === "created" && student.child_auth_user_id) {
    return { status: "created", childId: student.child_auth_user_id };
  }

  let childAuthUserId = student.child_auth_user_id;
  if (!childAuthUserId) {
    const existing = await admin.rpc("find_auth_user_id_by_email", { p_email: student.student_email });
    if (existing.data) {
      childAuthUserId = existing.data as string;
    } else {
      // matchbox512@snu.ac.kr 상담건 실측과 동일한 원인(좀비 auth.identities)이
      // 재시도 경로에도 그대로 적용된다 — 새 계정 생성 전에 먼저 정리한다.
      const cleanup = await admin.rpc("cleanup_orphaned_auth_identities", { p_email: student.student_email });
      if (cleanup.error) console.error("좀비 auth.identities 정리 실패(계속 진행):", student.student_email, cleanup.error);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: student.student_email,
        email_confirm: false,
        user_metadata: { name: student.student_name },
      });
      if (createError || !created?.user) {
        return { status: "failed", error: createError?.message ?? "학생 계정 생성에 실패했습니다." };
      }
      childAuthUserId = created.user.id;
    }
  }

  const { error: retryError } = await admin.rpc("retry_trial_onboarding_student", {
    p_link_id: linkId,
    p_link_student_id: linkStudentId,
    p_child_auth_user_id: childAuthUserId,
  });
  if (retryError) {
    return { status: "failed", error: retryError.message };
  }

  return { status: "created", childId: childAuthUserId };
}
