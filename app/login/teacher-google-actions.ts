"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { currentRequestOrigin } from "@/lib/request-origin";

// R2 Task 7 — 선생님 전용 "Google로 로그인" 진입점. 학생·보호자·관리자
// 로그인 방식(이메일/비밀번호)은 이 함수와 무관하다. hd 파라미터는 Google
// 계정 선택 화면에서 alton.education 계정을 우선 보여주는 힌트일 뿐 —
// 실제 신원 검증은 콜백(app/auth/teacher-callback/route.ts)에서
// workspace_google_user_id + workspace_email을 사전 등록된 프로비저닝
// 레코드와 대조해서 한다(hd 클레임이나 이메일만으로 신뢰하지 않는다).
export async function signInWithGoogleForTeacher(): Promise<void> {
  const supabase = await createClient();
  const siteUrl = await currentRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/teacher-callback`,
      queryParams: { hd: "alton.education", prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Google 로그인을 시작할 수 없습니다.");
  }
  redirect(data.url);
}
