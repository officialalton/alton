import { headers } from "next/headers";

// Server Action에서 절대 URL(이메일 링크, OAuth redirectTo 등)을 만들 때 쓴다.
// 고정된 NEXT_PUBLIC_SITE_URL 대신 실제 요청이 들어온 origin을 쓰는 이유:
// 이 값이 배포 환경(로컬/Preview/Production)마다 다른 실제 도메인과 어긋나면,
// 이메일 링크나 OAuth 콜백이 세션 쿠키가 없는 엉뚱한 origin으로 가서 사용자가
// 랜딩 페이지로 튕겨나가는 문제가 생긴다(app/auth/admin-google-callback/route.ts
// 등에서 이미 한 번 발견·수정된 것과 동일한 근본 원인).
export async function currentRequestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
}
