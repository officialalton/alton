"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { currentRequestOrigin } from "@/lib/request-origin";

// 통합 스태프 "Google로 로그인" 진입점(2026-09-22 사용자 지시 — 선생님/관리자/
// 컨설턴트 버튼 3개를 하나로 합침). 실제 역할 판정과 신원 검증은 콜백
// (app/auth/admin-google-callback/route.ts — 경로는 그대로 재사용, 로직만
// 통합)에서 한다.
export async function signInWithGoogleForStaff(): Promise<void> {
  const supabase = await createClient();
  const siteUrl = await currentRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/admin-google-callback`,
      queryParams: { hd: "alton.education", prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Google 로그인을 시작할 수 없습니다.");
  }
  redirect(data.url);
}
