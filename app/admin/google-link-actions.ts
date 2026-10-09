"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { currentRequestOrigin as currentOrigin } from "@/lib/request-origin";

// 관리자 Google 계정 self-service 연결. 관리자는 teacher_workspace_provisioning
// 같은 사전 발급 테이블이 없으므로, 최초 연결은 "이미 이메일/비밀번호로
// 로그인한 관리자가 로그인 상태에서 자기 Google 계정을 명시적으로 연결"하는
// self-service 절차로만 이뤄진다 — 콜드 Google 가입/로그인으로는 관리자
// 권한을 얻을 수 없다(2026-09-22 — 로그인 화면의 콜드 스타트 "관리자 —
// Google로 로그인" 버튼은 통합 스태프 버튼(app/login/staff-google-actions.ts)
// 으로 흡수됐다 — 그 버튼도 관리자 콜드 스타트는 지원하지 않는다, 이 파일의
// linkAdminGoogleAccount만이 관리자 Google 신원을 처음 연결하는 유일한 경로).

/**
 * requireAdmin()으로 게이트된 self-service 연결 시작점. 이미 로그인된
 * 세션에 Google identity를 추가한다(linkIdentity — signInWithOAuth와 달리
 * 새 세션/새 auth 사용자를 만들지 않고 현재 관리자 계정에 identity만
 * 덧붙인다).
 */
export async function linkAdminGoogleAccount(): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();
  const siteUrl = await currentOrigin();

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
