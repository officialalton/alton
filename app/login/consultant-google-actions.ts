"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { currentRequestOrigin } from "@/lib/request-origin";

// 컨설턴트 전용 "Google로 로그인" 진입점(teacher-google-actions.ts와 동일한
// 패턴). 실제 신원 검증은 콜백(app/auth/consultant-google-callback/route.ts)이
// consultant_workspace_provisioning과 대조해서 한다.
export async function signInWithGoogleForConsultant(): Promise<void> {
  const supabase = await createClient();
  const siteUrl = await currentRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/consultant-google-callback`,
      queryParams: { hd: "alton.education", prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Google 로그인을 시작할 수 없습니다.");
  }
  redirect(data.url);
}
