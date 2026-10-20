import { resolveLandingDestinations, type LandingDestinations } from "./cta";
import { loadLandingViewer } from "./viewer";
import { hasPublishedInsights } from "@/lib/insights/sanity";

/** 공개 페이지(로그인 상태 반영)용 목적지 + Insights 메뉴 노출 여부. */
export async function loadPublicDest(): Promise<LandingDestinations> {
  const [viewer, showInsights] = await Promise.all([loadLandingViewer(), hasPublishedInsights()]);
  return { ...resolveLandingDestinations(viewer), showInsights };
}

/** ISR 정적 페이지용: 세션(쿠키)을 읽지 않는다 — 읽으면 페이지가 동적이 된다. 비로그인 CTA(가입)로 고정. */
export async function loadStaticPublicDest(): Promise<LandingDestinations> {
  return { ...resolveLandingDestinations({ kind: "anonymous" }), showInsights: await hasPublishedInsights() };
}
