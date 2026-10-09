import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

/**
 * 2026-10-05 무료 회원 셀프 가입 전용 — implicit flow.
 * 기본 PKCE flow 로 signUp 하면 확인 메일의 {{ .TokenHash }} 가 `pkce_…` 로 발급되어, 가입을 시작한 브라우저의
 * code verifier 없이는 verifyOtp 가 "만료/이미 사용" 으로 실패한다(UAT 2026-10-05). 확인 메일을 다른 기기·브라우저에서
 * 열어도 되게 하려면 token_hash 가 PKCE 에 묶이지 않아야 하므로 가입 요청만 implicit flow 로 보낸다.
 */
export function createSignupClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { flowType: "implicit" } },
  );
}
