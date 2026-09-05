import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";

// R2 Task 7 — 선생님 Google OAuth 콜백. Google의 hd 도메인 클레임이나
// 이메일만으로 신뢰하지 않는다 — workspace_google_user_id + workspace_email이
// 둘 다 사전 등록된 teacher_workspace_provisioning 레코드와 일치할 때만
// profiles/teachers를 생성·연결한다(link_teacher_workspace_identity()가
// DB에서 최종 검증). 일치하지 않으면 Supabase가 방금 만든 auth.users 행을
// 즉시 삭제해 고아 계정·고아 세션을 남기지 않는다.
export async function GET(request: NextRequest) {
  // NEXT_PUBLIC_SITE_URL 대신 실제 요청 origin을 쓴다 — 고정 env 값을 쓰면
  // 배포 환경(로컬/Preview/Production)마다 다른 실제 도메인과 어긋나서 세션
  // 쿠키가 없는 엉뚱한 origin으로 리다이렉트되는 문제가 있다
  // (app/auth/admin-google-callback/route.ts에서 이미 한 번 발견·수정된 것과
  // 동일한 근본 원인 — 이 파일에는 그 수정이 누락돼 있었다, 2026-09-05 실사용 발견).
  const siteUrl = request.nextUrl.origin;
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
    await rejectAndCleanup(supabase, authUserId, "Google identity 정보를 확인할 수 없습니다.");
    return NextResponse.redirect(loginError(siteUrl, "Google 계정 정보를 확인할 수 없습니다."));
  }

  const { data: matches, error: findError } = await supabase.rpc(
    "find_teacher_provisioning_for_identity",
    { p_google_user_id: googleUserId, p_workspace_email: email }
  );
  const match = matches?.[0];

  if (findError || !match) {
    // 이메일·google_user_id 원문은 감사 기록에 남기지 않는다 — 비가역
    // 해시만 남겨 "같은 시도가 반복되는지" 사후 구분은 가능하되 원문은
    // 복원할 수 없게 한다.
    await rejectAndCleanup(
      supabase,
      authUserId,
      `사전 등록되지 않은 Google 계정 (email_hash=${hashIdentifier(email)}, google_id_hash=${hashIdentifier(googleUserId)})`
    );
    return NextResponse.redirect(loginError(siteUrl, `등록되지 않은 계정입니다. (debug googleUserId=${googleUserId})`));
  }

  const teacherName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    (data.user.user_metadata?.name as string | undefined) ??
    email;

  const { error: linkError } = await supabase.rpc("link_teacher_workspace_identity", {
    p_auth_user_id: authUserId,
    p_provisioning_id: match.id,
    p_google_user_id: googleUserId,
    p_workspace_email: email,
    p_teacher_name: teacherName,
  });

  if (linkError) {
    await rejectAndCleanup(supabase, authUserId, linkError.message);
    return NextResponse.redirect(loginError(siteUrl, "계정 연결에 실패했습니다: " + linkError.message));
  }

  return NextResponse.redirect(`${siteUrl}/teacher`);
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

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function rejectAndCleanup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string,
  reason: string
): Promise<void> {
  // log_workspace_link_rejected는 authenticated 권한으로 충분하므로 방금
  // 만들어진(곧 삭제될) 세션 client로 호출한다 — auth.admin.deleteUser()만
  // service-role이 필요하다.
  await supabase.rpc("log_workspace_link_rejected", { p_reason: reason });
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(authUserId);
}
