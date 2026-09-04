import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

// M4 (6/N) — 신규 보호자 계정 실제 생성 + finalize + /set-password 리다이렉트를
// 공통 헬퍼로 뺐다. "prospect 이메일 그대로 유지"와 "다른 이메일로 변경 후 확인
// 완료" 두 경로(app/api/trial-onboarding/confirm-email/route.ts,
// app/api/trial-onboarding/confirm-email-change/route.ts) 둘 다 이 함수로
// 수렴한다 — 계정 생성 로직이 두 곳에 따로 존재하며 갈라지는 것을 막기 위함.
export async function createGuardianAndStudentThenRedirect(params: {
  url: URL;
  linkId: string;
  guardianEmail: string;
  guardianName: string;
  studentEmail: string;
  studentName: string;
}): Promise<NextResponse> {
  const admin = createAdminClient();

  const { data: guardianCreated, error: guardianCreateError } = await admin.auth.admin.createUser({
    email: params.guardianEmail,
    email_confirm: true,
    user_metadata: { name: params.guardianName },
  });
  if (guardianCreateError || !guardianCreated?.user) {
    return redirectWithError(params.url, "보호자 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: studentCreated, error: studentCreateError } = await admin.auth.admin.createUser({
    email: params.studentEmail,
    email_confirm: true,
    user_metadata: { name: params.studentName },
  });
  if (studentCreateError || !studentCreated?.user) {
    return redirectWithError(params.url, "학생 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { error: finalizeError } = await admin.rpc("finalize_trial_onboarding_new_guardian", {
    p_link_id: params.linkId,
    p_auth_user_id: guardianCreated.user.id,
    p_child_auth_user_id: studentCreated.user.id,
  });
  if (finalizeError) {
    return redirectWithError(params.url, "계정 연결에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: params.guardianEmail,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return redirectWithError(params.url, "로그인 링크 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  await sendStudentSetPasswordEmail(admin, {
    url: params.url,
    studentEmail: params.studentEmail,
    studentName: params.studentName,
  });

  return NextResponse.redirect(
    new URL(
      `/set-password?role=parent&token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`,
      params.url
    )
  );
}

export function redirectWithError(url: URL, message: string): NextResponse {
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(message), url));
}

// 보호자는 지금 이 요청을 보낸 브라우저에서 바로 /set-password로 이어지지만,
// 학생은 별도 브라우저/기기라 학생 본인 이메일로 비밀번호 설정 링크를 보내야
// 계정을 실제로 쓸 수 있다 — 계정만 만들고 아무 안내도 없던 공백을 메운다.
// 이 발송 실패는 보호자 계정 생성 성공 자체를 막지 않는다(로그만 남긴다).
async function sendStudentSetPasswordEmail(
  admin: ReturnType<typeof createAdminClient>,
  params: { url: URL; studentEmail: string; studentName: string }
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: params.studentEmail,
  });
  if (error || !data?.properties?.hashed_token) {
    console.error("학생 비밀번호 설정 링크 생성에 실패했습니다:", params.studentEmail, error);
    return;
  }

  const setPasswordUrl = new URL(
    `/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`,
    params.url
  );

  await sendEmail({
    to: params.studentEmail,
    subject: "[Alton Education] 학생 계정 비밀번호 설정",
    html: `
      <p>안녕하세요, ${params.studentName}님.</p>
      <p>Alton Education 학생 계정이 생성되었습니다.</p>
      <p><a href="${setPasswordUrl.toString()}">여기를 눌러 비밀번호를 설정해주세요</a></p>
      <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });
}
