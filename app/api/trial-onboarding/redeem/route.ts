import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// M4 (1/N) — 체험 온보딩 링크 수락. app/api/invite/accept/route.ts(R2)와 동일한
// 신뢰 경계·패턴을 그대로 따른다: ALTON 자체 토큰 검증(redeem_trial_onboarding_link)
// → 신규 계정이면 admin API로 보호자·학생 Auth 사용자를 각각 생성 →
// finalize_trial_onboarding_new_guardian(프로필·household·자녀·연결을 한 트랜잭션으로)
// → /set-password로 자연스럽게 이어지도록 recovery 링크를 대신 생성한다.
//
// 이미 로그인된 기존 보호자가 본인 확인 후 연결하는 경로는 이 라우트가 아니라
// app/consult/trial-onboarding-actions.ts의 linkExistingGuardianToTrialOnboarding
// 서버 액션(로그인 세션 필요)이 담당한다 — 이 GET 라우트는 "신규 보호자" 경로 전용.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return redirectWithError(url, "유효하지 않은 온보딩 링크입니다.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_trial_onboarding_link", { p_token: token });
  if (error) {
    return redirectWithError(url, mapRedeemError(error.message));
  }
  const redeemed = data?.[0];
  if (!redeemed) {
    return redirectWithError(url, "유효하지 않은 온보딩 링크입니다.");
  }

  // 이미 로그인된 사용자가 이 링크를 열었다면(다른 계정으로) 본인 확인 없이 새
  // 계정을 자동으로 만들지 않는다 — 기존 보호자 경로 화면으로 안내한다.
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.includes("sb-")) {
    return NextResponse.redirect(
      new URL(`/consult/trial-onboarding?token=${encodeURIComponent(token)}&existing=1`, url)
    );
  }

  const { data: guardianCreated, error: guardianCreateError } = await admin.auth.admin.createUser({
    email: redeemed.guardian_email,
    email_confirm: true,
    user_metadata: { name: redeemed.guardian_name },
  });
  if (guardianCreateError || !guardianCreated?.user) {
    return redirectWithError(url, "보호자 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: studentCreated, error: studentCreateError } = await admin.auth.admin.createUser({
    email: redeemed.student_email,
    email_confirm: true,
    user_metadata: { name: redeemed.student_name },
  });
  if (studentCreateError || !studentCreated?.user) {
    return redirectWithError(url, "학생 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { error: finalizeError } = await admin.rpc("finalize_trial_onboarding_new_guardian", {
    p_link_id: redeemed.link_id,
    p_auth_user_id: guardianCreated.user.id,
    p_child_auth_user_id: studentCreated.user.id,
  });
  if (finalizeError) {
    return redirectWithError(url, "계정 연결에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: redeemed.guardian_email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return redirectWithError(url, "로그인 링크 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  return NextResponse.redirect(
    new URL(
      `/set-password?role=parent&token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`,
      url
    )
  );
}

function redirectWithError(url: URL, message: string) {
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(message), url));
}

function mapRedeemError(message: string): string {
  if (message.includes("이미 사용된")) return "이미 사용된 온보딩 링크입니다.";
  if (message.includes("취소된")) return "취소된 온보딩 링크입니다. 관리자에게 문의해주세요.";
  if (message.includes("만료된")) return "만료된 온보딩 링크입니다. 관리자에게 재발급을 요청해주세요.";
  return "유효하지 않은 온보딩 링크입니다.";
}
