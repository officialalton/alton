"use server";

// M4 후속 — 학생 본인 비밀번호 설정 초대(보호자 대상 "체험 온보딩 안내"와는
// 별개, 학생 계정 생성 직후 lib/trial-onboarding-finalize.ts가 보내는 메일)의
// 발송 상태 조회 + 재발송. 계정은 온보딩 redeem 시점에 이미 만들어졌으므로
// 여기서는 절대 새 Auth 계정/profiles/household를 만들지 않고, 기존 학생
// 계정에 대해서만 비밀번호 설정 링크를 다시 보낸다.
//
// 2026-09-06 정정 — 초대 상태는 이제 trial_onboarding_links(가족/링크 단위)가
// 아니라 trial_onboarding_link_students(학생 단위)에서 조회한다. consultationId는
// 학생별 칸반 카드(consultations.is_child_onboarding_card=true)의 id이며, 그
// 카드의 source_link_child_id가 trial_onboarding_link_students.id를 가리킨다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { resendStudentSetPasswordEmail } from "@/lib/trial-onboarding-finalize";

const CONSULT_CAPABILITY = "manage_consultations";

type LinkStudentRow = {
  id: string;
  student_email: string;
  student_name: string;
  link_id: string;
  invite_status: string | null;
  invite_sent_at: string | null;
  invite_error: string | null;
  invite_retry_count: number | null;
};

/** 2026-09-06 — consultation 행이 학생별 카드(source_link_child_id 있음)면 그 학생
 * 행을 바로 쓴다. 아니면(원 상담/가족 카드 id로 호출된 레거시 단일 학생 경로 —
 * app/admin/TrialOnboardingPanel.tsx의 MatchingTab 화면이 여전히 이 경로로 호출한다,
 * 회귀 없음 요구사항) 그 상담에 딸린 온보딩 링크에서 child_id와 일치하는(또는
 * 학생이 1명뿐인) 행을 찾아 대체한다. */
async function resolveLinkStudentForConsultation(
  admin: ReturnType<typeof createAdminClient>,
  consultation: { id: string; child_id: string | null; source_link_child_id: string | null }
): Promise<LinkStudentRow | null> {
  if (consultation.source_link_child_id) {
    const { data } = await admin
      .from("trial_onboarding_link_students")
      .select("id, student_email, student_name, link_id, invite_status, invite_sent_at, invite_error, invite_retry_count")
      .eq("id", consultation.source_link_child_id)
      .maybeSingle();
    return (data as LinkStudentRow | null) ?? null;
  }
  if (!consultation.child_id) return null; // 학생 계정 자체가 없으면 조회할 대상이 없다.
  const { data: link } = await admin
    .from("trial_onboarding_links")
    .select("id")
    .eq("consultation_id", consultation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!link) return null;
  const { data: candidates } = await admin
    .from("trial_onboarding_link_students")
    .select("id, student_email, student_name, link_id, invite_status, invite_sent_at, invite_error, invite_retry_count, child_auth_user_id")
    .eq("link_id", link.id);
  if (!candidates?.length) return null;
  if (consultation.child_id) {
    const match = candidates.find((c) => c.child_auth_user_id === consultation.child_id);
    if (match) return match as LinkStudentRow;
  }
  return candidates.length === 1 ? (candidates[0] as LinkStudentRow) : null;
}

export type StudentInviteStatus = {
  // 학생별 카드가 아니거나(가족 원본 카드) 아직 학생 계정 생성이 안 됐으면
  // 전부 null — "재발송할 대상 자체가 없다"는 뜻으로 관리자 화면에서 구분한다.
  linkStudentId: string | null;
  studentEmail: string | null;
  inviteStatus: "pending" | "sent" | "failed" | null;
  sentAt: string | null;
  error: string | null;
  retryCount: number;
  // auth.users.email_confirmed_at 기준 — 학생이 실제로 비밀번호 설정 링크를
  // 열어 제출까지 완료했는지(app/set-password/actions.ts
  // confirmOwnEmailAfterPasswordSet 참고, 계정 생성 시점엔 항상 false).
  completed: boolean;
};

export async function getStudentInviteStatusAction(consultationId: string): Promise<StudentInviteStatus> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: consultation } = await admin
    .from("consultations")
    .select("id, child_id, source_link_child_id")
    .eq("id", consultationId)
    .maybeSingle();

  const linkStudent = consultation ? await resolveLinkStudentForConsultation(admin, consultation) : null;

  let completed = false;
  if (consultation?.child_id) {
    const { data: userData } = await admin.auth.admin.getUserById(consultation.child_id);
    completed = !!userData?.user?.email_confirmed_at;
  }

  return {
    linkStudentId: linkStudent?.id ?? null,
    studentEmail: linkStudent?.student_email ?? null,
    inviteStatus: (linkStudent?.invite_status as StudentInviteStatus["inviteStatus"]) ?? null,
    sentAt: linkStudent?.invite_sent_at ?? null,
    error: linkStudent?.invite_error ?? null,
    retryCount: linkStudent?.invite_retry_count ?? 0,
    completed,
  };
}

export async function resendStudentInviteAction(consultationId: string): Promise<void> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: consultation, error: consultationError } = await admin
    .from("consultations")
    .select("id, child_id, source_link_child_id")
    .eq("id", consultationId)
    .maybeSingle();
  if (consultationError || !consultation?.child_id) {
    throw new Error("아직 학생 계정이 연결되지 않았습니다 — 온보딩이 완료된 상담/학생 카드만 재발송할 수 있습니다.");
  }

  // 계정을 다시 만들지 않는다 — 이미 존재하는 학생 Auth 계정에 대해서만
  // generateLink(recovery)로 새 링크를 발급해 재발송한다(요구사항: 중복 계정/
  // profile/household 생성 금지).
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(consultation.child_id);
  if (userError || !userData?.user) {
    throw new Error("학생 Auth 계정을 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }
  if (userData.user.email_confirmed_at) {
    throw new Error("이미 비밀번호 설정과 이메일 확인을 완료한 학생입니다 — 재발송이 필요하지 않습니다.");
  }
  const studentEmail = userData.user.email;
  if (!studentEmail) {
    throw new Error("학생 계정에 이메일이 없습니다. 관리자에게 문의해주세요.");
  }

  const linkStudent = await resolveLinkStudentForConsultation(admin, consultation);
  if (!linkStudent) {
    throw new Error("온보딩 학생 기록을 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  // 재시도만 독립적으로 증가시켜 형제자매 재발송 이력과 섞이지 않게 한다.
  await admin.rpc("retry_trial_onboarding_student", {
    p_link_id: linkStudent.link_id,
    p_link_student_id: linkStudent.id,
    p_child_auth_user_id: consultation.child_id,
    p_stage: "invite",
  });

  await resendStudentSetPasswordEmail({
    linkStudentId: linkStudent.id,
    studentEmail,
    studentName: linkStudent.student_name,
  });
}
