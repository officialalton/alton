"use client";

import { track as vercelTrack } from "@vercel/analytics";
import { isAnalyticsEnabled } from "./config";
import { ALLOWED_EVENT_PROPS, EVENT_SURFACE, type EventName, type EventPropsMap } from "./events";

// 제품 분석 P0(2026-09-25, docs/2026-09-25-product-analytics-prd.md) — 공통
// 이벤트 발신 모듈. 화면 코드는 이 track()만 부르고, 어떤 도구를 쓰는지·
// 어떤 속성이 허용되는지는 여기서만 결정한다.
//
// 개인정보 규칙(PRD §2): 이 함수는 이벤트별 화이트리스트(ALLOWED_EVENT_PROPS)에
// 있는 키만 내보낸다 — 호출부가 실수로 다른 속성을 넘겨도 새어나가지 않는다.
// page_path는 window.location에서 직접 읽어 쿼리스트링·fragment를 절대 포함하지
// 않는다(호출부가 넘긴 값을 쓰지 않는다 — 실수로 원본 URL을 넘겨도 안전).
//
// 실패 격리(PRD §3, §7): 분석 전송이 던지는 예외가 상담 신청·로그인 등 실제
// 기능을 막으면 안 된다 — 항상 삼킨다.

const firedOnce = new Set<string>();
let lastCallAt = new Map<string, number>();
const DEBOUNCE_MS = 300;

function currentPagePath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

function currentLocale(): string {
  if (typeof document === "undefined") return "ko";
  return document.documentElement.lang || "ko";
}

function currentReferrerDomain(): string | undefined {
  if (typeof document === "undefined" || !document.referrer) return undefined;
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return undefined;
  }
}

function sanitizeProps<E extends EventName>(eventName: E, rawProps: EventPropsMap[E]): Record<string, string> {
  const allowedKeys = ALLOWED_EVENT_PROPS[eventName] as readonly string[];
  const out: Record<string, string> = {};
  for (const key of allowedKeys) {
    const value = (rawProps as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim().length > 0) {
      out[key] = value;
    }
  }
  return out;
}

export function buildEventPayload<E extends EventName>(eventName: E, props: EventPropsMap[E]): Record<string, string> {
  const referrerDomain = currentReferrerDomain();
  return {
    surface: EVENT_SURFACE[eventName],
    page_path: currentPagePath(),
    locale: currentLocale(),
    ...(referrerDomain ? { referrer_domain: referrerDomain } : {}),
    ...sanitizeProps(eventName, props),
  };
}

export type TrackOptions = {
  /** 이 키로 한 번 발생하면 이후 같은 키로는 다시 발생하지 않는다(예: 폼당 1회인 consultation_started). */
  onceKey?: string;
};

export function trackEvent<E extends EventName>(eventName: E, props: EventPropsMap[E], options?: TrackOptions): void {
  if (!isAnalyticsEnabled()) return;

  if (options?.onceKey) {
    const key = `${eventName}:${options.onceKey}`;
    if (firedOnce.has(key)) return;
    firedOnce.add(key);
  } else {
    // 연타·중복 렌더 방지 — 짧은 시간 안의 같은 이벤트 호출은 한 번만 보낸다.
    const debounceKey = eventName;
    const now = Date.now();
    const last = lastCallAt.get(debounceKey) ?? 0;
    if (now - last < DEBOUNCE_MS) return;
    lastCallAt.set(debounceKey, now);
  }

  try {
    vercelTrack(eventName, buildEventPayload(eventName, props));
  } catch {
    // 분석 실패가 실제 기능에 영향을 주면 안 된다 — 조용히 무시.
  }
}

/** 테스트 전용 — 모듈 레벨 dedup 상태를 초기화한다. */
export function __resetTrackStateForTests(): void {
  firedOnce.clear();
  lastCallAt = new Map();
}
