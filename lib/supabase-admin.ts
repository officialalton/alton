import { createClient } from "@supabase/supabase-js";

// service_role 키로 RLS를 우회하는 관리자 전용 클라이언트.
// auth.users 조회(이메일)/초대 발송처럼 일반 SSR 클라이언트로는 할 수 없는
// 작업에만 서버 액션 안에서 사용한다 — 절대 클라이언트로 내려보내지 않는다.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
