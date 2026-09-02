import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 관리자 전용 Google 로그인 콜백 — 이 라우트가 없던 것이 버그의 원인이었다
// (관리자가 Google로 인증하면 랜딩 페이지로 떨어졌다). 선생님 콜백
// (app/auth/teacher-callback/route.ts)과는 완전히 분리된 별도 경로이며,
// 그 파일은 이 작업에서 건드리지 않는다.
//
// 실패 경로는 전부 명시적으로 /login?error=...로 보낸다 — 어떤 경우에도
// "/"(랜딩 페이지)로 조용히 떨어지지 않는다(그게 원래 버그였다).
export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";

  // Google 동의 화면에서 취소/실패한 경우 — 표준 OAuth error/error_description
  // 쿼리 파라미터로 온다.
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(loginError(siteUrl, "Google 로그인이 취소되었거나 실패했습니다."));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(loginError(siteUrl, "Google 로그인에 실패했습니다."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    return NextResponse.redirect(loginError(siteUrl, "Google 로그인에 실패했습니다."));
  }

  const authUserId = data.user.id;
  const email = data.user.email;
  const googleUserId = extractGoogleUserId(data.user);

  if (!email || !googleUserId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(loginError(siteUrl, "Google 계정 정보를 확인할 수 없습니다."));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .single();

  if (!profile) {
    // profiles 행이 없다 = ALTON에 등록된 적 없는 Google 계정으로 방금
    // 새로 생성된 auth 사용자 — 고아 계정/고아 세션을 남기지 않는다
    // (teacher-callback의 rejectAndCleanup과 동일한 목적).
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.redirect(loginError(siteUrl, "등록되지 않은 계정입니다. 관리자에게 문의해주세요."));
  }

  if (profile.role !== "admin") {
    // 본인의 실제 계정(학생/학부모/선생님 등)이지만 관리자가 아니다 —
    // 남의 계정이 아니므로 삭제하지 않고 세션만 종료한다.
    await supabase.auth.signOut();
    return NextResponse.redirect(loginError(siteUrl, "관리자 계정이 아닙니다."));
  }

  const { data: linked } = await supabase.rpc("current_user_admin_google_identity_linked", {
    p_google_user_id: googleUserId,
  });

  if (!linked) {
    // 관리자 계정은 맞지만 이 Google 신원이 사전에 연결(self-service link)된
    // 적이 없다 — 이메일/hd 클레임만으로는 신뢰하지 않는다.
    await supabase.auth.signOut();
    return NextResponse.redirect(
      loginError(
        siteUrl,
        "이 Google 계정은 관리자 계정에 연결되어 있지 않습니다. 먼저 관리자 화면에서 Google 계정을 연결해주세요."
      )
    );
  }

  return NextResponse.redirect(`${siteUrl}/admin`);
}

function extractGoogleUserId(user: {
  identities?: { provider: string; identity_data?: Record<string, unknown> }[] | null;
}): string | null {
  const identity = user.identities?.find((i) => i.provider === "google");
  const sub = identity?.identity_data?.sub;
  return typeof sub === "string" ? sub : null;
}

function loginError(siteUrl: string, message: string): string {
  return `${siteUrl}/login?error=${encodeURIComponent(message)}`;
}
