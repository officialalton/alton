import { NextResponse } from "next/server";

// 2026-09-11(제품 오너 재검토 — 실제 브라우저 E2E 재검증 중 지적) — 이 GET
// 라우트는 더 이상 계정을 만들지 않는다. 예전에는 "이 이메일로 계속" 버튼이
// 이 URL로의 단순 GET(<a href>)이었고, 그 GET 자체가 redeem_trial_onboarding_link()
// 호출 + 실제 Auth 계정 생성까지 전부 실행했다 — 명시적 버튼 클릭이라는
// 이유로 부작용을 GET에 둔 것 자체가 결함이다(이메일 클라이언트의 링크
// 프리스캔, 브라우저 프리페치, 재클릭 등 GET이 여러 번 일어날 수 있는
// 모든 경로가 그대로 계정 생성 경로가 된다). 이제 이 URL을 직접 열어도
// 확인 페이지로 리다이렉트만 할 뿐 아무 것도 바뀌지 않는다 — 실제 계정
// 생성·claim/lease 처리·복구 링크 발급·메일 발송은 그 페이지의 버튼이
// 호출하는 Server Action(confirmTrialOnboardingLinkAction, "use server")에서만
// 일어난다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("유효하지 않은 온보딩 링크입니다."), url));
  }
  return NextResponse.redirect(
    new URL(`/consult/trial-onboarding/confirm-email?token=${encodeURIComponent(token)}`, url)
  );
}
