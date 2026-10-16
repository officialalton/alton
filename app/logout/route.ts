import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// 2026-10-13 — 로그아웃은 서버 액션이 아니라 일반 POST + 303 리다이렉트로 처리한다.
// 서버 액션은 쿠키가 바뀌면 현재 화면(/admin 등)의 RSC를 세션 없는 상태로 다시 렌더링하려 하고,
// 그 사이 진행 중이던 탭 조회와 겹치면 라우트 에러 바운더리가 떴다. 이 핸들러는 현재 페이지를
// 다시 렌더링하지 않고 곧바로 /login으로 보낸다(JS 없이도 동작).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // 세션이 이미 없거나 네트워크 오류여도 로그인 화면으로 보낸다.
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, 303);
}
