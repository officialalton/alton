import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// (2026-08-30 R2 Task 4) 초대 수락 — ALTON 자체 토큰 검증(claim_account_invite,
// DB 상태 머신) → 신규 계정이면 admin API로 Auth 사용자 생성 →
// finalize_account_invite(프로필·역할·household 연결, 트랜잭션) → 기존
// /set-password 화면으로 자연스럽게 이어지도록 Supabase의 recovery 링크를
// 대신 생성해 그 액션 링크로 리다이렉트한다(우리 이메일은 우리 토큰만 담고,
// 실제 로그인 세션 발급은 Supabase Auth의 검증 절차를 그대로 재사용).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return redirectWithError(url, "유효하지 않은 초대 링크입니다.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_account_invite", { p_token: token });
  if (error) {
    if (error.message === "manual_review") {
      return NextResponse.redirect(new URL("/invite/manual-review", url));
    }
    return redirectWithError(url, mapClaimError(error.message));
  }

  const claim = data?.[0];
  if (!claim) {
    return redirectWithError(url, "유효하지 않은 초대 링크입니다.");
  }

  if (claim.status === "manual_review") {
    return NextResponse.redirect(new URL("/invite/manual-review", url));
  }

  let authUserId: string | null = claim.auth_user_id;

  if (!claim.target_profile_id) {
    if (!authUserId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: claim.email_normalized,
        email_confirm: true,
        user_metadata: { name: claim.invitee_name },
      });
      if (createError || !created?.user) {
        return redirectWithError(url, "계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
      }
      authUserId = created.user.id;
    }

    const { error: finalizeError } = await admin.rpc("finalize_account_invite", {
      p_invite_id: claim.invite_id,
      p_auth_user_id: authUserId,
    });
    if (finalizeError) {
      return redirectWithError(url, "계정 연결에 실패했습니다. 관리자에게 문의해주세요.");
    }
  }

  // /set-password는 Supabase 자체 확인 URL(GET만으로 토큰 소진, 메일 스캐너
  // prefetch에 취약)을 거치지 않고 token_hash를 직접 받아 verifyOtp를 폼
  // 제출 시점에만 호출한다(supabase/templates/recovery.html과 동일 패턴) —
  // action_link 대신 hashed_token을 그대로 재사용해 같은 방식으로 연결한다.
  const setPasswordPath = claim.role === "parent" ? "/set-password?role=parent" : "/set-password";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: claim.email_normalized,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return redirectWithError(url, "로그인 링크 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const separator = setPasswordPath.includes("?") ? "&" : "?";
  return NextResponse.redirect(
    new URL(
      `${setPasswordPath}${separator}token_hash=${linkData.properties.hashed_token}&type=recovery`,
      url
    )
  );
}

function redirectWithError(url: URL, message: string) {
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(message), url));
}

function mapClaimError(message: string): string {
  switch (message) {
    case "invalid_token":
      return "유효하지 않은 초대 링크입니다.";
    case "expired":
      return "만료된 초대입니다. 새로 초대를 요청해주세요.";
    case "revoked":
      return "철회된 초대입니다. 관리자에게 문의해주세요.";
    case "superseded":
      return "이 링크는 더 이상 유효하지 않습니다. 가장 최근에 받은 초대 메일을 확인해주세요.";
    case "failed":
      return "초대 처리에 실패했습니다. 관리자에게 문의해주세요.";
    default:
      return "초대를 처리할 수 없습니다.";
  }
}
