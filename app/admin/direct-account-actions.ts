"use server";

// 2026-09-06(M4 마지막 항목) — 지인/추천: 상담 없이 바로 보호자+학생 계정 생성.
// 기존 복수자녀 온보딩(app/admin/trial-onboarding-actions.ts)의 링크 발급·이메일
// 발송·redeem·finalize 플로우를 그대로 재사용한다 — 다른 점은 consultation_id가
// 처음부터 없다는 것뿐이다(create_direct_onboarding_link_multi RPC,
// supabase/migrations/20261214000000_m4_direct_account_creation.sql 참고).
// 실제 Auth 계정 생성은 여기서 하지 않는다 — 보호자가 이메일의 링크를 열어야
// (기존과 동일하게) lib/trial-onboarding-finalize.ts가 계정을 만든다.

import { createHash } from "node:crypto";
import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { currentRequestOrigin } from "@/lib/request-origin";

const CONSULT_CAPABILITY = "manage_consultations";
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DirectOnboardingStudentInput = {
  name: string;
  email: string;
  grade?: string;
  subject?: string;
};

export type SendDirectOnboardingNoticeResult =
  | { status: "sent"; linkId: string; sentAt: string; localRedeemUrl: string | null }
  | { status: "failed"; linkId: string; error: string };

function assertDirectOnboardingParamsValid(params: {
  guardianEmail: string;
  guardianName: string;
  students: DirectOnboardingStudentInput[];
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

// 2026-09-06(#441 마스킹 버그와 동일 원인 방어) — sendTrialOnboardingNoticeAction과
// 동일하게 함수 전체를 감싸 항상 구조화된 결과를 반환한다(예외를 던지지 않음).
export async function sendDirectOnboardingNoticeAction(params: {
  guardianEmail: string;
  guardianName: string;
  students: DirectOnboardingStudentInput[];
}): Promise<SendDirectOnboardingNoticeResult> {
  try {
    return await sendDirectOnboardingNoticeInternal(params);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", linkId: "", error: message };
  }
}

async function sendDirectOnboardingNoticeInternal(params: {
  guardianEmail: string;
  guardianName: string;
  students: DirectOnboardingStudentInput[];
}): Promise<SendDirectOnboardingNoticeResult> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  assertDirectOnboardingParamsValid(params);
  const admin = createAdminClient();
  const guardianEmail = params.guardianEmail.trim();
  const guardianName = params.guardianName.trim();

  const studentsPayload = params.students.map((s) => ({
    name: s.name.trim(),
    email: s.email.trim(),
    grade: s.grade?.trim() || null,
    subject: s.subject?.trim() || null,
  }));

  const { data, error } = await admin.rpc("create_direct_onboarding_link_multi", {
    p_guardian_email: guardianEmail,
    p_guardian_name: guardianName,
    p_students: studentsPayload,
  });
  if (error || !data?.[0]) throw new Error(error?.message ?? "온보딩 링크 발급에 실패했습니다.");
  const linkId: string = data[0].link_id;
  const rawToken: string | undefined = data[0].raw_token;

  if (!rawToken) {
    return { status: "failed", linkId, error: "발송에 필요한 링크 토큰을 확인할 수 없습니다." };
  }

  const origin = await currentRequestOrigin();
  const redeemUrl = `${origin}/api/trial-onboarding/redeem?token=${encodeURIComponent(rawToken)}`;
  const studentNamesLabel = studentsPayload.map((s) => escapeHtml(s.name)).join(", ");
  const html = `
    <p>안녕하세요, ${escapeHtml(guardianName)}님.</p>
    <p>${studentNamesLabel} 학생의 Alton Education 계정 생성을 위해 아래 링크에서 계정을 만들어주세요.</p>
    <p><a href="${redeemUrl}">${redeemUrl}</a></p>
    <p>이 링크는 72시간 동안 유효합니다.</p>
  `;
  const contentHash = createHash("sha256").update(html).digest("hex");
  const nowIso = new Date().toISOString();

  try {
    await sendEmail({ to: guardianEmail, subject: "[Alton Education] 계정 생성 안내", html });
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
    .insert({ link_id: linkId, event_type: "notice_sent", actor_id: actorUserId, detail: { guardian_email: guardianEmail } });

  const localRedeemUrl = process.env.NODE_ENV !== "production" ? redeemUrl : null;

  return { status: "sent", linkId, sentAt: nowIso, localRedeemUrl };
}
