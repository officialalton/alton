"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

// 관리자 Google 로그인 버그 수정 — 선생님 흐름(app/login/teacher-google-actions.ts,
// app/auth/teacher-callback/route.ts)과 완전히 분리된 별도 경로. 관리자는
// teacher_workspace_provisioning 같은 사전 발급 테이블이 없으므로, 최초
// 연결은 "이미 이메일/비밀번호로 로그인한 관리자가 로그인 상태에서 자기
// Google 계정을 명시적으로 연결"하는 self-service 절차로만 이뤄진다 —
// 콜드 Google 가입/로그인으로는 관리자 권한을 얻을 수 없다.

/**
 * requireAdmin()으로 게이트된 self-service 연결 시작점. 이미 로그인된
 * 세션에 Google identity를 추가한다(linkIdentity — signInWithOAuth와 달리
 * 새 세션/새 auth 사용자를 만들지 않고 현재 관리자 계정에 identity만
 * 덧붙인다).
 */
export async function linkAdminGoogleAccount(): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";

  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/admin-google-link-callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Google 계정 연결을 시작할 수 없습니다.");
  }
  redirect(data.url);
}

/**
 * 로그인 화면의 관리자 전용 "Google로 로그인" 진입점(미인증 방문자용).
 * 최종 승인은 콜백(app/auth/admin-google-callback/route.ts)이
 * admin_google_identities 연결 여부 + role='admin'을 대조해서 한다.
 */
export async function signInWithGoogleForAdmin(): Promise<void> {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/admin-google-callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? "Google 로그인을 시작할 수 없습니다.");
  }
  redirect(data.url);
}
