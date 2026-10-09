import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAccountDestination } from "@/lib/auth";
import { pendingFreeSignupDestination } from "@/lib/free-member-signup";
import { consumeReturnTo } from "@/lib/guardian-link/return-to";

/**
 * 로그인 화면을 거치지 않고 세션만 새로 생겼을 때(예: 비밀번호 설정 직후)
 * 역할에 맞는 홈으로 보내주는 공용 경유지.
 */
export default async function PostAuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // 2026-10-05 무료 학습 회원(S1) — 셀프 가입 대기자(프로필 없음+표식)만 완료 화면으로.
  const pending = pendingFreeSignupDestination(user, !!profile);
  if (pending) redirect(pending);

  // 2026-10-05 무료 회원 S4 — 보호자 연결 화면(/guardian-link/[token])에서 로그인/비밀번호 설정으로 빠진
  // 보호자는 그 화면으로 되돌린다(쿠키, 허용 접두사만 — lib/guardian-link/return-to.ts).
  if (profile?.role === "parent") {
    const returnTo = await consumeReturnTo();
    if (returnTo) redirect(returnTo);
  }

  redirect(await resolveAccountDestination(supabase, profile?.role));
}
