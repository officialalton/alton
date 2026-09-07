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
    p_admin_id: actorUserId,
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

// 2026-09-07(UAT 후속) — 지인/추천 링크(consultation_id가 null)로 잘못된
// 이메일이 발송된 경우 관리자가 고쳐서 재발송할 수 있어야 한다. 상담 경로의
// reissueTrialOnboardingLinkAction()은 내부적으로 create_trial_onboarding_link_multi
// (p_consultation_id가 실제 상담을 가리켜야 함)만 호출하므로 consultation_id가
// null인 이 경로의 링크에는 쓸 수 없다(호출 시 "상담을 찾을 수 없습니다: null"로
// 실패) — 그래서 create_direct_onboarding_link_multi를 쓰는 별도 함수가 필요하다.
// app/admin/trial-onboarding-actions.ts의 reissueTrialOnboardingLinkAction()이
// link.consultation_id가 null이면 이 함수로 위임한다.
export async function reissueDirectOnboardingLinkAction(
  linkId: string,
  overrides?: {
    guardianEmail?: string;
    guardianName?: string;
    students?: { name: string; email: string; grade?: string; subject?: string }[];
  }
): Promise<SendDirectOnboardingNoticeResult> {
  try {
    return await reissueDirectOnboardingLinkInternal(linkId, overrides);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", linkId, error: message };
  }
}

async function reissueDirectOnboardingLinkInternal(
  linkId: string,
  overrides?: {
    guardianEmail?: string;
    guardianName?: string;
    students?: { name: string; email: string; grade?: string; subject?: string }[];
  }
): Promise<SendDirectOnboardingNoticeResult> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("id, consultation_id, guardian_email, guardian_name, status, redeemed_at")
    .eq("id", linkId)
    .maybeSingle();
  if (linkError) throw new Error(linkError.message);
  if (!link) throw new Error("존재하지 않는 온보딩 링크입니다.");
  if (link.consultation_id !== null) {
    throw new Error("상담 연결 링크입니다 — 재발급은 상담 화면의 재발급 기능을 사용해주세요.");
  }
  if (link.status !== "pending" || link.redeemed_at) {
    throw new Error("이미 보호자가 확인했거나 취소/만료된 링크는 재발급할 수 없습니다.");
  }

  const { data: students, error: studentsError } = await admin
    .from("trial_onboarding_link_students")
    .select("id, student_name, student_email, student_grade, student_subject, status")
    .eq("link_id", linkId)
    .order("created_at", { ascending: true });
  if (studentsError) throw new Error(studentsError.message);
  if (!students?.length) throw new Error("학생 명단을 찾을 수 없어 재발급할 수 없습니다.");

  // 2026-09-07(정정) — 처음에는 취소(cancelled)한 학생을 재발급 대상에서
  // 영구 제외했으나, 그러면 한 번 취소한 학생은 같은 가족 링크로 다시는
  // 보낼 수 없게 되는 버그였다(제품 오너 실사용 중 발견). 이미 계정이 생성된
  // (created) 학생만 재발급 대상에서 뺀다 — pending/failed/cancelled는 모두
  // 새 링크로 다시 편집·재발송할 수 있어야 한다(트리거된 새 링크에는 상태가
  // 새로 pending으로 시작하므로 "취소"는 되돌릴 수 있는 선택이어야 한다).
  const activeStudents = students.filter((s) => s.status !== "created");
  if (!activeStudents.length) {
    throw new Error("이미 계정이 생성되지 않은 학생이 없어 재발급할 수 없습니다.");
  }

  const guardianEmail = overrides?.guardianEmail?.trim() || link.guardian_email;
  const guardianName = overrides?.guardianName?.trim() || link.guardian_name;
  const studentsPayload =
    overrides?.students && overrides.students.length === activeStudents.length
      ? overrides.students.map((s, i) => ({
          name: s.name.trim() || activeStudents[i].student_name,
          email: s.email.trim() || activeStudents[i].student_email,
          grade: s.grade ?? activeStudents[i].student_grade ?? undefined,
          subject: s.subject ?? activeStudents[i].student_subject ?? undefined,
        }))
      : activeStudents.map((s) => ({
          name: s.student_name,
          email: s.student_email,
          grade: s.student_grade ?? undefined,
          subject: s.student_subject ?? undefined,
        }));

  assertDirectOnboardingParamsValid({ guardianEmail, guardianName, students: studentsPayload });

  // 기존 링크를 폐기(revoked)하고 새 링크를 발급 — 상담 경로의
  // reissueTrialOnboardingLinkAction과 동일한 정책(항상 revoke 후 재발급).
  await admin.from("trial_onboarding_links").update({ status: "revoked" }).eq("id", linkId);
  await admin.from("trial_onboarding_link_events").insert({
    link_id: linkId,
    event_type: "revoked",
    actor_id: actorUserId,
    detail: { reason: "관리자 재발급(지인/추천)" },
  });

  return sendDirectOnboardingNoticeInternal({
    guardianEmail,
    guardianName,
    students: studentsPayload,
  });
}

// 2026-09-07(UAT 후속) — 잘못된 이메일 등으로 등록된 학생 1명을 이 온보딩
// 링크에서 취소한다(더 이상 계정 생성 대상이 아니게 된다 — DB 함수
// cancel_trial_onboarding_link_student()가 상태 검증·감사 로그를 담당).
// 2026-09-07(발송 내역 목록 화면) — 실사용 중 발견된 설계 공백: 지인/추천
// 발송 건은 상담 카드가 애초에 없어서, DirectAccountCreationForm은 발송
// 성공 시 토스트만 띄우고 폼을 닫아버리면 그 발송 건을 다시 찾아볼 방법이
// 없었다. TrialOnboardingLinkProgress는 이미 있지만 링크 하나의 상세만
// 보여준다 — 그걸 펼칠 링크 목록 자체가 없었다. 여기서는
// consultation_id가 null인(지인/추천 경로로 생성된) 링크를 전부 조회해
// 목록 화면에 필요한 요약(보호자, 발송 시각/상태, 학생 수·상태 요약)을
// 반환한다.
export type DirectOnboardingLinkSummary = {
  linkId: string;
  guardianEmail: string;
  guardianName: string;
  status: "pending" | "redeemed" | "expired" | "revoked";
  noticeDeliveryStatus: "pending" | "sent" | "failed";
  noticeSentAt: string | null;
  createdAt: string;
  studentCount: number;
  studentsCreated: number;
  studentsFailed: number;
  studentsCancelled: number;
};

export async function listDirectOnboardingLinksAction(): Promise<DirectOnboardingLinkSummary[]> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: links, error: linksError } = await admin
    .from("trial_onboarding_links")
    .select("id, guardian_email, guardian_name, status, notice_delivery_status, notice_sent_at, created_at")
    .is("consultation_id", null)
    .order("created_at", { ascending: false });
  if (linksError) throw new Error(linksError.message);
  if (!links?.length) return [];

  const linkIds = links.map((l) => l.id);
  const { data: students, error: studentsError } = await admin
    .from("trial_onboarding_link_students")
    .select("link_id, status")
    .in("link_id", linkIds);
  if (studentsError) throw new Error(studentsError.message);

  const summaryByLinkId = new Map<string, { total: number; created: number; failed: number; cancelled: number }>();
  for (const s of students ?? []) {
    const entry = summaryByLinkId.get(s.link_id) ?? { total: 0, created: 0, failed: 0, cancelled: 0 };
    entry.total += 1;
    if (s.status === "created") entry.created += 1;
    else if (s.status === "failed") entry.failed += 1;
    else if (s.status === "cancelled") entry.cancelled += 1;
    summaryByLinkId.set(s.link_id, entry);
  }

  return links.map((l) => {
    const summary = summaryByLinkId.get(l.id) ?? { total: 0, created: 0, failed: 0, cancelled: 0 };
    return {
      linkId: l.id,
      guardianEmail: l.guardian_email,
      guardianName: l.guardian_name,
      status: l.status as DirectOnboardingLinkSummary["status"],
      noticeDeliveryStatus: l.notice_delivery_status as DirectOnboardingLinkSummary["noticeDeliveryStatus"],
      noticeSentAt: l.notice_sent_at,
      createdAt: l.created_at,
      studentCount: summary.total,
      studentsCreated: summary.created,
      studentsFailed: summary.failed,
      studentsCancelled: summary.cancelled,
    };
  });
}

export async function cancelDirectOnboardingLinkStudentAction(
  linkStudentId: string,
  reason?: string
): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_trial_onboarding_link_student", {
    p_link_student_id: linkStudentId,
    p_admin_id: actorUserId,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
