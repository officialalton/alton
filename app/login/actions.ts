"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAccountDestination } from "@/lib/auth";
import { pendingFreeSignupDestination } from "@/lib/free-member-signup";

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

  redirect(await resolveAccountDestination(supabase, profile?.role));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
