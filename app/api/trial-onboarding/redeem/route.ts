import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// M4 (6/N) — 체험 온보딩 링크 수락. 이제 이 라우트는 계정을 바로 만들지
// 않는다 — prospect 이메일(링크에 저장된 guardian_email)과 보호자가 실제로
// 쓰고 싶은 로그인 이메일이 다를 수 있어(요구사항: 다른 주소로 변경 가능,
// 변경 시 별도 소유 확인 필요), 확인 화면(/consult/trial-onboarding/confirm-email)
// 으로 넘겨 거기서 이메일을 확정한 뒤에만 실제 Auth 계정을 만든다.
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
