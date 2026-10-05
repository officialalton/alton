"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAccountDestination } from "@/lib/auth";
import { pendingFreeSignupDestination } from "@/lib/free-member-signup";
import { consumeReturnTo } from "@/lib/guardian-link/return-to";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(
      "/login?error=" +
        encodeURIComponent("이메일 또는 비밀번호가 올바르지 않습니다.")
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  // 2026-10-05 무료 학습 회원(S1) — 이메일은 확인했지만 프로비저닝 전에 이탈한 셀프 가입 대기자만
  // 완료 화면으로. 표식 없는 프로필 없는 계정은 종전대로 resolveAccountDestination의 unknown→로그아웃.
  const pending = pendingFreeSignupDestination(data.user, !!profile);
  if (pending) redirect(pending);

  // 2026-10-05 무료 회원 S4 — 보호자 연결 화면(/guardian-link/[token])에서 로그인/비밀번호 설정으로 빠진
  // 보호자는 그 화면으로 되돌린다(쿠키, 허용 접두사만 — lib/guardian-link/return-to.ts).
  if (profile?.role === "parent") {
    const returnTo = await consumeReturnTo();
    if (returnTo) redirect(returnTo);
  }

  redirect(await resolveAccountDestination(supabase, profile?.role));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
