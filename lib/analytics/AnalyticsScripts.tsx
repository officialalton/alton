import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isAnalyticsEnabled } from "./config";

// 제품 분석 P0(2026-09-25) — Vercel Web Analytics/Speed Insights는 production
// 배포에서만 마운트한다(app/layout.tsx가 서버 컴포넌트라 이 조건이 서버에서
// 결정된다 — local/preview에서는 스크립트 자체가 아예 내려가지 않는다).
// @vercel/analytics의 track()도 이 스크립트가 없으면(window.va 미등록) 실제
// 네트워크 전송 없이 조용히 큐잉만 하고 끝나므로, 이 조건 하나로 운영 지표에
// non-production 데이터가 섞이는 걸 막는다.
export default function AnalyticsScripts() {
  if (!isAnalyticsEnabled()) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
