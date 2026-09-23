import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 컨설턴트 전용 Google OAuth 콜백 — app/auth/teacher-callback/route.ts와
// 동일한 원칙(사전 등록된 이메일만 최초 로그인 시 자동 연결, 이후 로그인은
// 그때 확인한 google_user_id까지 일치해야 함). 일치하지 않으면 방금 생성된
// auth.users 행을 즉시 삭제해 고아 계정·고아 세션을 남기지 않는다.
export async function GET(request: NextRequest) {
  const siteUrl = request.nextUrl.origin;

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
    await rejectAndCleanup(authUserId);
    return NextResponse.redirect(loginError(siteUrl, "Google 계정 정보를 확인할 수 없습니다."));
  }

  const { data: matches, error: findError } = await supabase.rpc("find_consultant_provisioning_for_identity", {
    p_workspace_email: email,
  });
  const match = matches?.[0];

  if (findError || !match) {
    await rejectAndCleanup(authUserId);
    return NextResponse.redirect(loginError(siteUrl, "등록되지 않은 계정입니다. 관리자에게 문의해주세요."));
  }

  const consultantName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    (data.user.user_metadata?.name as string | undefined) ??
    email;

  const { error: linkError } = await supabase.rpc("link_consultant_workspace_identity", {
    p_auth_user_id: authUserId,
    p_provisioning_id: match.id,
    p_google_user_id: googleUserId,
    p_workspace_email: email,
    p_name: consultantName,
  });

  if (linkError) {
    await rejectAndCleanup(authUserId);
    return NextResponse.redirect(loginError(siteUrl, "계정 연결에 실패했습니다: " + linkError.message));
  }

  return NextResponse.redirect(`${siteUrl}/consultant`);
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

async function rejectAndCleanup(authUserId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(authUserId);
}
