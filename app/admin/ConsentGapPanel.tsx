"use client";

import ConsentGapSection from "./ConsentGapSection";
import { listConsentGapsAction, listCompletedConsentsAction } from "./consent-actions";
import { useTabCachedData } from "./use-tab-cached-data";
import type { ConsentGapItem, CompletedConsentItem } from "./consultation-data";

// P4-3 1단계 — `문서 > 동의서`의 데이터 컨테이너.
//
// SSR prop 드릴링 대신 TTL 캐시로 지연 조회한다. 같은 cacheKey를 쓰는 다른
// 화면(오류 현황판의 "보호자 동의 차단" 섹션)이 이미 읽었다면 TTL 안에서는
// 네트워크 요청이 나가지 않는다 — 두 탭이 공통 부모 없이 데이터를 공유한다.
//
// 상태가 자주 바뀌는 화면이 아니라 TTL을 30초로 둔다(정규 계약 발송의 10초와 대비).
export const CONSENT_GAPS_CACHE_KEY = "consent-gaps";
export const CONSENT_COMPLETED_CACHE_KEY = "consent-completed";
export const CONSENT_CACHE_TTL_MS = 30_000;

export default function ConsentGapPanel() {
  const gaps = useTabCachedData<ConsentGapItem[]>({
    cacheKey: CONSENT_GAPS_CACHE_KEY,
    ttlMs: CONSENT_CACHE_TTL_MS,
    fetcher: listConsentGapsAction,
  });
  const completed = useTabCachedData<CompletedConsentItem[]>({
    cacheKey: CONSENT_COMPLETED_CACHE_KEY,
    ttlMs: CONSENT_CACHE_TTL_MS,
    fetcher: listCompletedConsentsAction,
  });

  const error = gaps.error ?? completed.error;
  if (error) {
    return <p className="text-[13px] text-red px-1 py-6">{error}</p>;
  }
  if (gaps.data === null || completed.data === null) {
    return <p className="text-[13px] text-grey-500 px-1 py-6">불러오는 중…</p>;
  }

  return <ConsentGapSection gaps={gaps.data} completed={completed.data} />;
}
