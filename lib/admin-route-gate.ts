import { NextResponse } from "next/server";

/**
 * 관리자 전용 점검 경로의 거부 응답.
 *
 * 2026-09-13: 미로그인과 "로그인했지만 관리자가 아님"이 똑같이 403에 같은 문구로
 * 나오고 있었다. 그래서 "로그인한 비관리자도 막힌다"를 확인하려 해도 응답만 보고는
 * 미로그인과 구분할 수 없었다 — 확인 자체가 증거가 되지 못했다.
 *
 * 내부 상태를 흘리는 것이 아니다. 401(누구인지 모른다)과 403(누구인지 알지만
 * 권한이 없다)은 HTTP가 원래 구분하는 것이고, 문구도 일반 사용자에게 그대로
 * 보여줄 수 있는 수준이다. 오류 원문·id·기술 상태값은 담지 않는다.
 */
export function adminGateDenied(e: unknown): NextResponse {
  const message = e instanceof Error ? e.message : "";
  const notLoggedIn = message.includes("로그인");
  return NextResponse.json(
    { error: notLoggedIn ? "로그인이 필요합니다." : "관리자만 확인할 수 있습니다." },
    { status: notLoggedIn ? 401 : 403 }
  );
}
