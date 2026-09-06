"use server";

// M4 후속 — 학생 본인 비밀번호 설정 초대(보호자 대상 "체험 온보딩 안내"와는
// 별개, 학생 계정 생성 직후 lib/trial-onboarding-finalize.ts가 보내는 메일)의
// 발송 상태 조회 + 재발송. 계정은 온보딩 redeem 시점에 이미 만들어졌으므로
// 여기서는 절대 새 Auth 계정/profiles/household를 만들지 않고, 기존 학생
// 계정에 대해서만 비밀번호 설정 링크를 다시 보낸다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentRequestOrigin } from "@/lib/request-origin";
import { resendStudentSetPasswordEmail } from "@/lib/trial-onboarding-finalize";

const CONSULT_CAPABILITY = "manage_consultations";

export type StudentInviteStatus = {
  // 온보딩 링크가 아직 발급/소진되지 않았거나, 학생 Auth 계정이 아직 없으면
  // 전부 null — "재발송할 대상 자체가 없다"는 뜻으로 관리자 화면에서 구분한다.
  linkId: string | null;
  studentEmail: string | null;
  inviteStatus: "pending" | "sent" | "failed" | null;
  sentAt: string | null;
  error: string | null;
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
    .select("child_id")
    .eq("id", consultationId)
    .maybeSingle();

  const { data: link } = await admin
    .from("trial_onboarding_links")
    .select("id, student_email, student_invite_status, student_invite_sent_at, student_invite_error")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let completed = false;
  if (consultation?.child_id) {
    const { data: userData } = await admin.auth.admin.getUserById(consultation.child_id);
    completed = !!userData?.user?.email_confirmed_at;
  }

  return {
    linkId: link?.id ?? null,
    studentEmail: link?.student_email ?? null,
    inviteStatus: (link?.student_invite_status as StudentInviteStatus["inviteStatus"]) ?? null,
    sentAt: link?.student_invite_sent_at ?? null,
    error: link?.student_invite_error ?? null,
    completed,
  };
}

export async function resendStudentInviteAction(consultationId: string): Promise<void> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: consultation, error: consultationError } = await admin
    .from("consultations")
    .select("child_id")
    .eq("id", consultationId)
    .maybeSingle();
  if (consultationError || !consultation?.child_id) {
    throw new Error("아직 학생 계정이 연결되지 않았습니다 — 온보딩이 완료된 상담만 재발송할 수 있습니다.");
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

  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("id, student_name")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (linkError || !link) {
    throw new Error("온보딩 링크 기록을 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const origin = await currentRequestOrigin();
  await resendStudentSetPasswordEmail({
    url: new URL(origin),
    linkId: link.id,
    studentEmail,
    studentName: link.student_name,
  });
}
