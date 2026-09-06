import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail, escapeHtml } from "@/lib/email";

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
    // 학생 본인이 이 이메일을 실제로 확인했는지는 여기서 알 수 없다 — 온보딩은
    // 보호자가 대행 입력한 값이다(이 파일 상단 주석 참고). email_confirm을 여기서
    // true로 찍으면 이후 어떤 검증도 무의미해진다(2026-09-05 코드 점검 발견 — 실제
    // 이메일 확인 게이트가 항상 통과하는 죽은 코드였음). 이 계정이 처음 비밀번호를
    // 설정할 때(app/set-password/page.tsx → confirmOwnEmailAfterPasswordSet)만
    // true로 올린다 — 그게 "본인이 실제로 이 이메일을 열어봤다"는 첫 실증 이벤트다.
    email: params.studentEmail,
    email_confirm: false,
    user_metadata: { name: params.studentName },
  });
  if (studentCreateError || !studentCreated?.user) {
    // 학생 계정 생성이 실패했으면 이미 만든 보호자 계정이 고아로 남는다 —
    // 정리하지 않으면 이 이메일로는 재시도조차 불가능해진다(2026-09-05 코드
    // 점검 발견). profiles/household 등 DB 행은 아직 안 만들어졌으므로
    // Auth 계정만 지우면 된다.
    await admin.auth.admin.deleteUser(guardianCreated.user.id).catch((e) => {
      console.error("고아 보호자 Auth 계정 정리 실패:", guardianCreated.user.id, e);
    });
    return redirectWithError(params.url, "학생 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { error: finalizeError } = await admin.rpc("finalize_trial_onboarding_new_guardian", {
    p_link_id: params.linkId,
    p_auth_user_id: guardianCreated.user.id,
    p_child_auth_user_id: studentCreated.user.id,
  });
  if (finalizeError) {
    // 두 Auth 계정 모두 만들어졌지만 DB 연결(finalize)이 실패한 경우 — 마찬가지로
    // 고아 Auth 계정 2개가 관리자 개입 없이는 복구 경로가 없던 문제를 정리한다.
    await Promise.all([
      admin.auth.admin.deleteUser(guardianCreated.user.id).catch((e) => {
        console.error("고아 보호자 Auth 계정 정리 실패:", guardianCreated.user.id, e);
      }),
      admin.auth.admin.deleteUser(studentCreated.user.id).catch((e) => {
        console.error("고아 학생 Auth 계정 정리 실패:", studentCreated.user.id, e);
      }),
    ]);
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
    linkId: params.linkId,
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
// 이 발송 실패는 보호자 계정 생성 성공 자체를 막지 않는다(성공/실패 상태를
// trial_onboarding_links.student_invite_status에 남겨 관리자 화면에서 확인·
// 재발송할 수 있게 한다 — 이전에는 console.error만 남기고 아무 흔적이 없었다).
async function sendStudentSetPasswordEmail(
  admin: ReturnType<typeof createAdminClient>,
  params: { url: URL; linkId: string; studentEmail: string; studentName: string }
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: params.studentEmail,
  });
  if (error || !data?.properties?.hashed_token) {
    const message = error?.message ?? "링크 생성에 실패했습니다.";
    console.error("학생 비밀번호 설정 링크 생성에 실패했습니다:", params.studentEmail, error);
    await admin
      .from("trial_onboarding_links")
      .update({ student_invite_status: "failed", student_invite_error: message })
      .eq("id", params.linkId);
    return;
  }

  const setPasswordUrl = new URL(
    `/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`,
    params.url
  );

  try {
    await sendEmail({
      to: params.studentEmail,
      subject: "[Alton Education] 학생 계정 비밀번호 설정",
      html: `
        <p>안녕하세요, ${escapeHtml(params.studentName)}님.</p>
        <p>Alton Education 학생 계정이 생성되었습니다.</p>
        <p><a href="${setPasswordUrl.toString()}">여기를 눌러 비밀번호를 설정해주세요</a></p>
        <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
        <p>감사합니다.<br/>Alton Education</p>
      `,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("학생 비밀번호 설정 이메일 발송에 실패했습니다:", params.studentEmail, e);
    await admin
      .from("trial_onboarding_links")
      .update({ student_invite_status: "failed", student_invite_error: message })
      .eq("id", params.linkId);
    return;
  }

  await admin
    .from("trial_onboarding_links")
    .update({
      student_invite_status: "sent",
      student_invite_sent_at: new Date().toISOString(),
      student_invite_error: null,
    })
    .eq("id", params.linkId);
}

// 관리자의 "학생 초대 재발송" 액션(app/admin/student-invite-actions.ts)이
// 재사용하는 공용 헬퍼 — 계정을 다시 만들지 않고, 이미 존재하는 학생 Auth
// 계정에 대해서만 비밀번호 설정 이메일을 다시 보낸다.
export async function resendStudentSetPasswordEmail(params: {
  url: URL;
  linkId: string;
  studentEmail: string;
  studentName: string;
}): Promise<void> {
  const admin = createAdminClient();
  await sendStudentSetPasswordEmail(admin, params);
}
