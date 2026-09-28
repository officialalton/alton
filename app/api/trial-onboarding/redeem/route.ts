import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

// M4 (6/N) — 체험 온보딩 링크 수락. 이제 이 라우트는 계정을 바로 만들지
// 않는다 — prospect 이메일(링크에 저장된 guardian_email)과 보호자가 실제로
// 쓰고 싶은 로그인 이메일이 다를 수 있어(요구사항: 다른 주소로 변경 가능,
// 변경 시 별도 소유 확인 필요), 확인 화면(/consult/trial-onboarding/confirm-email)
// 으로 넘겨 거기서 이메일을 확정한 뒤에만 실제 Auth 계정을 만든다.
//
// 2026-09-28(초기 고객 절차 단순화) — 이미 로그인된 사용자가 이 링크를 여는
// 경우("기존 보호자" 분기)에 보내던 /consult/trial-onboarding(체험 Smart Notes
// 동의 화면)을 제거했다. 그 화면은 애초에 linkExistingGuardianToTrialOnboarding()
// 호출을 실제로 트리거하는 UI가 없어(기존에도 배선이 안 됨 — 자녀가 연결 안 된
// 채로 "배정된 과목이 없습니다"만 영구히 보여주는 상태였다) 이 경로로는 사실상
// 아무 동작도 하지 않고 있었다. 화면을 없앤 지금은 이미 로그인된 사용자를 그냥
// 본인 홈(/parent)으로 보낸다 — 새 계정을 함부로 만들지 않는다는 원래 취지는
// 그대로 유지된다.
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
  // 계정을 자동으로 만들지 않는다 — 본인 홈으로 안내한다.
  //
  // 2026-09-10(P0) — 이전에는 쿠키 문자열에 "sb-"가 포함되는지만 봤는데,
  // Supabase는 로그아웃 후·PKCE 시작 시에도 sb-<ref>-auth-token-code-verifier
  // 같은 쿠키를 남긴다. 관리자가 같은 브라우저로 새 초대 링크를 테스트할 때
  // 이 잔여 쿠키 때문에 "로그인된 사용자"로 오판될 수 있어, 쿠키 문자열이
  // 아니라 실제 유효 세션(auth.getUser())으로 판정한다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(new URL("/parent", url));
  }

  return NextResponse.redirect(
    new URL(`/consult/trial-onboarding/confirm-email?token=${encodeURIComponent(token)}`, url)
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
