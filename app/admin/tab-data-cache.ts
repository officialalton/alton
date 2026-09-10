"use client";

// 2026-09-10(P1 재진입 성능 배치) — 관리자 탭(신규/문의·면담/통합 일정/예약)이
// 탭 전환마다 언마운트→리마운트되면서 직전 데이터를 버리고 매번 빈 화면부터
// 다시 불러오는 문제를 고치기 위한 탭 데이터 캐시. 모든 탭을 마운트 상태로
// 유지(hidden)하는 방식은 채택하지 않는다(초기 로드 비용·메모리 증가) —
// 대신 컴포넌트 트리 바깥의 순수 JS 모듈 상태에 마지막 데이터를 짧게 보관해,
// 컴포넌트가 리마운트돼도 이 모듈은 그대로 남아있는 것을 이용한다.
//
// 사용자별 데이터를 오래 들고 있지 않도록: (1) 이 캐시는 항상 "현재 로그인한
// 관리자 id"에 묶이고, 다른 관리자 id로 바뀌면 즉시 전체 폐기한다(계정 전환
// 회귀 방지), (2) 로그아웃 시 명시적으로 전체 폐기한다, (3) 브라우저를 완전히
// 새로고침/재방문하면 이 모듈 자체가 다시 초기화되므로 자동으로 사라진다 —
// localStorage 등 브라우저 영속 저장소에는 쓰지 않는다(요구사항: 전역 장기
// 캐시 금지).

type CacheEntry = { data: unknown; fetchedAt: number };

const cache = new Map<string, CacheEntry>();
let activeAdminUserId: string | null = null;

/** AdminShell 마운트 시 한 번 호출한다. 이전과 다른 관리자 id면(계정 전환·
 * 권한 변경으로 세션이 바뀐 경우 포함) 캐시를 즉시 비운다. */
export function setActiveAdminUser(adminUserId: string): void {
  if (activeAdminUserId !== null && activeAdminUserId !== adminUserId) {
    cache.clear();
  }
  activeAdminUserId = adminUserId;
}

/** 로그아웃 시 호출한다. */
export function clearAdminTabCache(): void {
  cache.clear();
  activeAdminUserId = null;
}

export function getCachedTabData<T>(key: string): CacheEntry & { data: T } | null {
  const entry = cache.get(key);
  return entry ? (entry as CacheEntry & { data: T }) : null;
}

export function setCachedTabData<T>(key: string, data: T): void {
  if (activeAdminUserId === null) return; // setActiveAdminUser 이전에는 캐시하지 않는다
  cache.set(key, { data, fetchedAt: Date.now() });
}
