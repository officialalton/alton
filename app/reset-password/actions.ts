"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { currentRequestOrigin } from "@/lib/request-origin";

export async function requestReset(formData: FormData) {
  const email = formData.get("email") as string;
  const siteUrl = await currentRequestOrigin();

  // 암묵(implicit) 플로우 — PKCE 는 요청한 브라우저의 코드 검증자에 묶여, 다른 브라우저/기기에서 링크를 열면
  // "만료 또는 유효하지 않음"이 된다(가입 확인과 같은 문제). 링크가 어느 브라우저에서 열려도 동작해야 한다.
  const supabase = createSupabaseJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/set-password`,
  });

  // 이메일 존재 여부와 무관하게 항상 동일한 결과를 보여준다 (계정 존재 여부 노출 방지).
  redirect("/reset-password?sent=1");
}
