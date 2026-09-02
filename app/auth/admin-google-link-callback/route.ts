import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// 관리자 self-service Google 계정 연결 콜백. app/admin/google-link-actions.ts의
// linkAdminGoogleAccount()에서만 도달한다 — 이미 인증된 관리자 세션에
// identity가 덧붙여진 채로 돌아오므로, 여기서는 그 세션이 여전히
// role='admin'인지 다시 확인한 뒤 link_admin_google_identity()로 최종
// 기록한다. 선생님 콜백과 무관한 완전히 별도의 경로.
export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(linkError(siteUrl, "Google 계정 연결이 취소되었거나 실패했습니다."));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(linkError(siteUrl, "Google 계정 연결에 실패했습니다."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    return NextResponse.redirect(linkError(siteUrl, "Google 계정 연결에 실패했습니다."));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.redirect(linkError(siteUrl, "관리자 계정에서만 Google 계정을 연결할 수 있습니다."));
  }

  const googleUserId = extractGoogleUserId(data.user);
  const email = data.user.email;
  if (!googleUserId || !email) {
    return NextResponse.redirect(linkError(siteUrl, "Google 계정 정보를 확인할 수 없습니다."));
  }

  const { error: linkErr } = await supabase.rpc("link_admin_google_identity", {
    p_google_user_id: googleUserId,
    p_google_email: email,
  });
  if (linkErr) {
    return NextResponse.redirect(linkError(siteUrl, linkErr.message));
  }

  return NextResponse.redirect(`${siteUrl}/admin?googleLinkSuccess=1`);
}

function extractGoogleUserId(user: {
  identities?: { provider: string; identity_data?: Record<string, unknown> }[] | null;
}): string | null {
  const identity = user.identities?.find((i) => i.provider === "google");
  const sub = identity?.identity_data?.sub;
  return typeof sub === "string" ? sub : null;
}

function linkError(siteUrl: string, message: string): string {
  return `${siteUrl}/admin?googleLinkError=${encodeURIComponent(message)}`;
}
