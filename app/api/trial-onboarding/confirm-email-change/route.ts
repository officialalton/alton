import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 2026-09-11(제품 오너 재지적 — GET 무변경 요구 미충족) — confirm_trial_login_email_change()는
// "멱등"(두 번째 호출부터 같은 결과)이지 "무변경"이 아니다 — status='pending'인
// 요청을 처음 열 때 status를 'confirmed'로 바꾸고 confirmed_at을 채우고
// trial_onboarding_link_events에 이벤트까지 남긴다. 이 상태 전이 자체가
// GET만으로 실행되면 안 된다(실사용 진입점이 없다는 사실은 면제 사유가
// 아니다 — 코드 자체가 안전해야 한다). 여기서는 순수 조회 전용
// peek_trial_login_email_change()(어떤 UPDATE/INSERT도 하지 않음)로 상태만
// 확인하고 확인 페이지로 넘긴다. 실제 상태 전이(confirmed 처리)는 그 페이지의
// 버튼이 호출하는 Server Action(confirmTrialOnboardingEmailChangeAction →
// confirm_trial_login_email_change)에서만 실행한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("유효하지 않은 확인 링크입니다."), url));
  }

  const admin = createAdminClient();
  const { data: peekData, error: peekError } = await admin.rpc("peek_trial_login_email_change", {
    p_token: token,
  });
  const peeked = peekData?.[0];
  if (peekError || !peeked) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("유효하지 않거나 만료된 확인 링크입니다."), url)
    );
  }
  if (peeked.status === "expired") {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("만료된 확인 링크입니다. 관리자에게 재발급을 요청해주세요."), url)
    );
  }

  return NextResponse.redirect(
    new URL(`/consult/trial-onboarding/confirm-email-change?token=${encodeURIComponent(token)}`, url)
  );
}
