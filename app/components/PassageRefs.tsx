"use client";

import { createContext, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { rewriteLineRefs } from "@/lib/ap-exam/passage-layout";

type Legacy = Array<{ from: number; to: number }>;
/** 한 문항 화면(지문+문항+선택지+해설)에서 지문 블록이 알려 주는 '옛 줄 번호 → 화면 번호' 표. 지문이 하나일 때만 본문 속 줄 참조를 다시 쓴다. */
export type PassageRefsStore = { register: (id: string, map: Legacy | null) => void; unregister: (id: string) => void; subscribe: (cb: () => void) => () => void; get: () => Legacy | null };

function createStore(): PassageRefsStore {
  const maps = new Map<string, Legacy>(); const subs = new Set<() => void>(); let snap: Legacy | null = null;
  const recompute = () => { const next = maps.size === 1 ? [...maps.values()][0] : null; if (next !== snap) { snap = next; subs.forEach((f) => f()); } };
  return {
    register(id, map) { if (map) maps.set(id, map); else maps.delete(id); recompute(); },
    unregister(id) { maps.delete(id); recompute(); },
    subscribe(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
    get: () => snap,
  };
}

const Ctx = createContext<PassageRefsStore | null>(null);
export function PassageRefsScope({ children }: { children: ReactNode }) {
  const ref = useRef<PassageRefsStore | null>(null); if (!ref.current) ref.current = createStore();
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}
export const usePassageRefsStore = (): PassageRefsStore | null => useContext(Ctx);

/** 본문 속 'line 7' / 'lines 7-9' 를 지금 보이는 번호로 바꾸는 함수. 범위 밖이거나 지문 측정 전이면 그대로 돌려준다. */
export function usePassageRefsRewrite(): (text: string) => string {
  const store = useContext(Ctx);
  const map = useSyncExternalStore(store ? store.subscribe : noopSubscribe, store ? store.get : nullSnap, nullSnap);
  return useMemo(() => (map ? (t: string) => rewriteLineRefs(t, map) : identity), [map]);
}
const noopSubscribe = () => () => {};
const nullSnap = () => null;
const identity = (t: string) => t;
