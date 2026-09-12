"use client";

import { useEffect, useRef, useState } from "react";
import { getCachedTabData, setCachedTabData } from "./tab-data-cache";

// 2026-09-10(P1 재진입 성능 배치) — 탭이 리마운트돼도 tab-data-cache.ts의
// 마지막 데이터를 즉시 보여주고, ttlMs가 지났으면 화면은 그대로 둔 채
// 백그라운드로 조용히 갱신한다. seedData(SSR 초기 데이터)가 있으면 최초
// 진입도 같은 캐시에 기록해, 최초 진입과 재진입이 같은 흐름을 타게 한다.
export function useTabCachedData<T>(opts: {
  cacheKey: string;
  ttlMs: number;
  seedData?: T;
  fetcher: () => Promise<T>;
}) {
  const { cacheKey, ttlMs, seedData, fetcher } = opts;

  const initial = getCachedTabData<T>(cacheKey);
  const [data, setData] = useState<T | null>(initial?.data ?? seedData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetchedAtRef = useRef<number>(initial?.fetchedAt ?? 0);
  const inFlightRef = useRef(false);

  async function runFetch(force: boolean) {
    if (inFlightRef.current) return;
    if (!force) {
      const age = Date.now() - fetchedAtRef.current;
      if (data !== null && age <= ttlMs) return;
    }
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const result = await fetcher();
      setData(result);
      setCachedTabData(cacheKey, result);
      fetchedAtRef.current = Date.now();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (seedData !== undefined && !getCachedTabData<T>(cacheKey)) {
      setCachedTabData(cacheKey, seedData);
      fetchedAtRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return {
    data,
    error,
    loading: data === null,
    refreshing,
    refresh: () => runFetch(true),
  };
}
