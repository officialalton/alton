"use client";

import { invalidateCachedTabData } from "./tab-data-cache";

// P4-3 1단계 — `문서 > 동의서`와 `신규 > 오류/재처리 현황판`이 공유하는 캐시 키.
// 두 화면이 같은 키를 쓰므로 한 번 버리면 양쪽 모두 다음 조회에서 최신을 읽는다.
//
// 컴포넌트가 아니라 별도 모듈에 둔다 — 변경 동작(consent-mutations.ts)이
// 화면을 import 하지 않고도 무효화할 수 있어야 하기 때문이다.
export const CONSENT_GAPS_CACHE_KEY = "consent-gaps";
export const CONSENT_COMPLETED_CACHE_KEY = "consent-completed";
export const CONSENT_CACHE_TTL_MS = 30_000;

/** 동의 상태를 바꾸는 동작이 성공한 뒤에 부른다. */
export function invalidateConsentCaches(): void {
  invalidateCachedTabData(CONSENT_GAPS_CACHE_KEY, CONSENT_COMPLETED_CACHE_KEY);
}
