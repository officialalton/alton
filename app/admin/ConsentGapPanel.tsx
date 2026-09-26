"use client";

import ConsentGapSection from "./ConsentGapSection";
import { listConsentGapsAction, listCompletedConsentsAction } from "./consent-actions";
import { useTabCachedData } from "./use-tab-cached-data";
import {
  CONSENT_GAPS_CACHE_KEY,
  CONSENT_COMPLETED_CACHE_KEY,
  CONSENT_CACHE_TTL_MS,
  invalidateConsentCaches,
} from "./consent-cache";
import type { ConsentGapItem, CompletedConsentItem } from "./consultation-data";

// P4-3 1단계 — `문서 > 동의서`의 데이터 컨테이너.
//
// SSR prop 드릴링 대신 TTL 캐시로 지연 조회한다. 같은 cacheKey를 쓰는 다른
// 화면(오류 현황판의 "보호자 동의 차단" 섹션)이 이미 읽었다면 TTL 안에서는
// 네트워크 요청이 나가지 않는다 — 두 탭이 공통 부모 없이 데이터를 공유한다.
//
// 상태가 자주 바뀌는 화면이 아니라 TTL을 30초로 둔다(정규 계약 발송의 10초와 대비).
// 캐시 키와 무효화 함수는 consent-cache.ts가 정본이다.
export default function ConsentGapPanel() {
  // 이 화면은 들어올 때마다 다시 읽는다. 동의는 보호자가 앱 밖에서 마치므로
  // 관리자가 탭으로 "돌아온" 행동 자체가 최신을 보려는 의도다 — TTL이 남았다는
  // 이유로 이전 상태를 보여주면 안 된다. 직전 데이터는 그대로 보여주고
  // 배경에서 갱신하므로 화면이 비지 않는다.
  const gaps = useTabCachedData<ConsentGapItem[]>({
    cacheKey: CONSENT_GAPS_CACHE_KEY,
    ttlMs: CONSENT_CACHE_TTL_MS,
    fetcher: listConsentGapsAction,
    revalidateOnMount: true,
  });
  const completed = useTabCachedData<CompletedConsentItem[]>({
    cacheKey: CONSENT_COMPLETED_CACHE_KEY,
    ttlMs: CONSENT_CACHE_TTL_MS,
    fetcher: listCompletedConsentsAction,
    revalidateOnMount: true,
  });

  const error = gaps.error ?? completed.error;
  if (error) {
    return <p className="text-[13px] text-red px-1 py-6">{error}</p>;
  }
  if (gaps.data === null || completed.data === null) {
    return <p className="text-[13px] text-grey-500 px-1 py-6">불러오는 중…</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => {
            // 가족이 앱 밖에서 동의를 마친 경우처럼, 이 앱이 알 수 없는 변화를
            // 즉시 반영하려면 TTL을 기다리지 않고 다시 읽을 수 있어야 한다.
            invalidateConsentCaches();
            void gaps.refresh();
            void completed.refresh();
          }}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
        >
          새로고침
        </button>
        {(gaps.refreshing || completed.refreshing) && (
          <span className="text-[11.5px] text-grey-500">불러오는 중…</span>
        )}
      </div>
      <ConsentGapSection gaps={gaps.data} completed={completed.data} />
    </div>
  );
}
