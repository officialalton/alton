import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { ProfileRole } from "@/lib/session-view";

// 통합 스태프 Google 로그인 콜백(2026-09-22 사용자 지시 — "선생님/관리자/
// 컨설턴트 로그인 버튼을 하나로 합치고 계정에 맞게 자동으로 들어가게").
// 기존에 세 개(teacher-callback/admin-google-callback/consultant-google-callback)
// 로 나뉘어 있던 콜백을 이 파일 하나로 합쳤다 — 경로 자체는 그대로
// admin-google-callback을 재사용한다(Google Cloud Console의 승인된 리디렉션
// URI 목록을 바꾸지 않기 위해 — 이미 이 경로만 승인돼 있다).
//
// 흐름:
//   1) profiles 행이 이미 있다(재로그인) → role로 바로 라우팅(관리자는 기존과
//      동일하게 매번 Google 신원 연결 여부를 재확인한다).
//   2) profiles 행이 없다(이 Google 계정으로 첫 로그인) → 선생님 프로비저닝
//      → 컨설턴트 프로비저닝 순서로 사전 등록 여부를 확인해 매칭되면 그
//      자리에서 연결한다. 관리자는 콜드 스타트를 지원하지 않는다(기존 설계
//      그대로 — self-service link만 가능, app/admin/google-link-actions.ts).
//   실패 경로는 전부 명시적으로 /login?error=...로 보낸다 — 어떤 경우에도
//   "/"(랜딩 페이지)로 조용히 떨어지지 않는다.
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
    await supabase.auth.signOut();
    return NextResponse.redirect(loginError(siteUrl, "Google 계정 정보를 확인할 수 없습니다."));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .maybeSingle();

  if (profile) {
    return routeExistingProfile({ supabase, siteUrl, role: profile.role as ProfileRole, googleUserId });
  }

  // 이 Google 계정으로 ALTON에 처음 로그인한다 — 선생님·컨설턴트 사전
  // 등록 여부를 순서대로 확인한다(관리자는 콜드 스타트 미지원).
  const teacherMatch = await findTeacherProvisioning(supabase, googleUserId, email);
  if (teacherMatch) {
    return linkAsTeacher({ supabase, siteUrl, authUserId, email, googleUserId, provisioningId: teacherMatch.id, name: staffName(data.user, email) });
  }

  const consultantMatch = await findConsultantProvisioning(supabase, email);
  if (consultantMatch) {
    return linkAsConsultant({ supabase, siteUrl, authUserId, email, googleUserId, provisioningId: consultantMatch.id, name: staffName(data.user, email) });
  }

  await rejectAndCleanup(supabase, authUserId, `사전 등록되지 않은 Google 계정 (email_hash=${hashIdentifier(email)})`);
  return NextResponse.redirect(loginError(siteUrl, "등록되지 않은 계정입니다. 관리자에게 문의해주세요."));
}

async function routeExistingProfile(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  siteUrl: string;
  role: ProfileRole;
  googleUserId: string;
}): Promise<NextResponse> {
  const { supabase, siteUrl, role, googleUserId } = params;

  if (role === "admin") {
    const { data: linked } = await supabase.rpc("current_user_admin_google_identity_linked", {
      p_google_user_id: googleUserId,
    });
    if (!linked) {
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

  if (role === "teacher" || role === "consultant") {
    return NextResponse.redirect(`${siteUrl}/${role}`);
  }

  // 학생/학부모 등 스태프가 아닌 본인 계정 — 남의 계정이 아니므로 삭제하지
  // 않고 세션만 종료한다.
  await supabase.auth.signOut();
  return NextResponse.redirect(loginError(siteUrl, "직원(선생님·관리자·컨설턴트) 계정이 아닙니다."));
}

async function findTeacherProvisioning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  googleUserId: string,
  email: string
): Promise<{ id: string } | null> {
  const { data: matches } = await supabase.rpc("find_teacher_provisioning_for_identity", {
    p_google_user_id: googleUserId,
    p_workspace_email: email,
  });
  return (matches as Array<{ id: string; status: string }> | null)?.[0] ?? null;
}

async function linkAsTeacher(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  siteUrl: string;
  authUserId: string;
  email: string;
  googleUserId: string;
  provisioningId: string;
  name: string;
}): Promise<NextResponse> {
  const { supabase, siteUrl, authUserId, email, googleUserId, provisioningId, name } = params;
  const { error: linkError } = await supabase.rpc("link_teacher_workspace_identity", {
    p_auth_user_id: authUserId,
    p_provisioning_id: provisioningId,
    p_google_user_id: googleUserId,
    p_workspace_email: email,
    p_teacher_name: name,
  });
  if (linkError) {
    await rejectAndCleanup(supabase, authUserId, linkError.message);
    return NextResponse.redirect(loginError(siteUrl, "계정 연결에 실패했습니다: " + linkError.message));
  }
  return NextResponse.redirect(`${siteUrl}/teacher`);
}

async function findConsultantProvisioning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
): Promise<{ id: string } | null> {
  const { data: matches } = await supabase.rpc("find_consultant_provisioning_for_identity", {
    p_workspace_email: email,
  });
  return (matches as Array<{ id: string; workspace_google_user_id: string | null }> | null)?.[0] ?? null;
}

async function linkAsConsultant(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  siteUrl: string;
  authUserId: string;
  email: string;
  googleUserId: string;
  provisioningId: string;
  name: string;
}): Promise<NextResponse> {
  const { supabase, siteUrl, authUserId, email, googleUserId, provisioningId, name } = params;
  const { error: linkError } = await supabase.rpc("link_consultant_workspace_identity", {
    p_auth_user_id: authUserId,
    p_provisioning_id: provisioningId,
    p_google_user_id: googleUserId,
    p_workspace_email: email,
    p_name: name,
  });
  if (linkError) {
    await rejectAndCleanup(supabase, authUserId, linkError.message);
    return NextResponse.redirect(loginError(siteUrl, "계정 연결에 실패했습니다: " + linkError.message));
  }
  return NextResponse.redirect(`${siteUrl}/consultant`);
}

function staffName(user: { user_metadata?: Record<string, unknown> }, email: string): string {
  return (
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email
  );
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
  try {
    await supabase.rpc("log_workspace_link_rejected", { p_reason: reason });
  } catch {
    // 감사 로그 실패는 무시 — 계정 정리가 우선.
  }
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(authUserId);
}
