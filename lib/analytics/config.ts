// 제품 분석 P0(2026-09-25, docs/2026-09-25-product-analytics-prd.md) — 환경 분리.
// Vercel의 시스템 환경변수(VERCEL_ENV)는 기본적으로 클라이언트 번들에 노출되지
// 않는다("Automatically expose System Environment Variables" 프로젝트 설정에
// 의존하는 건 취약하다) — next.config.ts에서 NEXT_PUBLIC_VERCEL_ENV로 명시적으로
// 복사해 서버·클라이언트 양쪽에서 항상 같은 값을 본다. 로컬 개발·테스트에서는
// 이 값 자체가 없으므로 자연히 false가 된다.
export function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}
