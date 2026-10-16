"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";

// M4(사용자 지시, 2026-09-05): 학생 Auth 계정은 생성 시점에 email_confirm이
// 곧바로 true로 찍혀 있어(lib/trial-onboarding-finalize.ts), "학생이 실제로
// 이메일을 확인했는지"를 보는 resolveVerifiedStudentEmail()의 검사가 항상
// 통과하는 죽은 코드였다(학생이 이메일을 열어본 적 없어도 Calendar 초대에
// 그 이메일을 그대로 씀). 학생 계정은 이제 email_confirm: false로 생성하고,
// 이 액션을 "본인이 실제로 이메일의 비밀번호 설정 링크를 열어 새 비밀번호를
// 제출에 성공한" 시점(app/set-password/page.tsx)에만 호출해 그때 처음
// email_confirm을 true로 올린다 — 학생에게 별도 단계를 추가하지 않는다(이미
// 필수였던 첫 비밀번호 설정 자체가 검증 이벤트가 된다). 스푸핑 방지를 위해
// 파라미터로 대상 user id를 받지 않고, 이 요청 자신의 세션 사용자만 확인한다.
export async function confirmOwnEmailAfterPasswordSet(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
}
