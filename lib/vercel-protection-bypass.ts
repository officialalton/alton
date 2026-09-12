// M4 Preview 전용: Vercel Deployment Protection이 켜진 이 배포는 브라우저 세션이
// 없는 순수 서버 대 서버 POST(예: DocuSign Connect 완료 웹훅)를 전부 401로
// 막는다(실측 확인 — 웹훅 URL에 직접 POST하면 우리 라우트 코드가 아니라 Vercel의
// 보호 페이지가 응답). Google Workspace Events가 PULL 방식으로만 연동된 것도
// 같은 제약 때문이다. DocuSign처럼 콜백 URL을 상대방 서비스에 등록해야 하는
// PUSH 웹훅은 이 우회 없이는 Preview에서 아예 도달할 수 없다.
//
// 정책(사용자 확정, 2026-09-05, 이번 M4 Preview 통합 검증 한정):
// - Production 환경/운영 웹훅 URL에는 적용하지 않는다(호출부에서 Preview 전용으로
//   한정 — 이 함수 자체는 환경 분기를 하지 않으므로 호출 지점에서 책임진다).
// - 일반 고객용 화면 링크에는 붙이지 않는다 — 오직 제3자 서비스에 등록하는
//   서버 대 서버 웹훅 콜백 URL에만 사용한다.
// - 웹훅 서명 검증(verifyDocusignWebhookSignature 등)은 이 우회와 무관하게 그대로
//   유지한다 — bypass 토큰은 "Vercel 앞단 통과"용일 뿐 인증 수단이 아니다.
export function appendVercelProtectionBypass(url: string): string {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return url;
  const withBypass = new URL(url);
  withBypass.searchParams.set("x-vercel-protection-bypass", secret);
  return withBypass.toString();
}
