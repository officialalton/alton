import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 2026-09-11(제품 오너 재검토 — GET 부작용 제거) — confirm_trial_login_email_change()
// 자체(=이메일로 받은 확인 링크를 클릭해 "이 새 이메일을 실제로 소유한다"는
// 것을 증명하는 단계)는 멱등(이미 confirmed면 그대로 같은 결과를 돌려줄 뿐
// 예외를 던지지 않는다)이라 GET에 남겨둔다 — 이메일로 전달되는 확인 링크가
// GET인 것 자체는 업계 표준이고, 다시 열어도 상태가 어긋나지 않는다.
// 하지만 그 다음 단계(실제 Auth 계정 생성·복구 링크 발급·메일 발송)는 더
// 이상 여기서 실행하지 않는다 — 확인 페이지로 넘겨 그 페이지의 버튼이
// 호출하는 Server Action(confirmTrialOnboardingEmailChangeAction)에서만
// 실행한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("유효하지 않은 확인 링크입니다."), url));
  }

  const admin = createAdminClient();
  const { data: confirmData, error: confirmError } = await admin.rpc("confirm_trial_login_email_change", {
    p_token: token,
  });
  if (confirmError || !confirmData?.[0]) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("유효하지 않거나 만료된 확인 링크입니다."), url)
    );
  }

  return NextResponse.redirect(
    new URL(`/consult/trial-onboarding/confirm-email-change?token=${encodeURIComponent(token)}`, url)
  );
}
