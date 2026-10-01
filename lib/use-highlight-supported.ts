"use client";

import { useSyncExternalStore } from "react";

// CSS Custom Highlight API 지원 여부. 서버 렌더에는 window 가 없어 항상 false 인데,
// 렌더 중 `typeof window` 로 바로 판정하면 지원 브라우저의 첫 클라이언트 렌더가 서버
// HTML 과 달라져 하이드레이션 오류(React #418)가 난다(2026-09-29 QA: 학생·학부모
// 과제 탭). useSyncExternalStore 는 하이드레이션 중엔 서버 스냅샷(false)을 쓰고
// 직후 실제 값으로 다시 렌더한다.
const subscribe = () => () => {};
const getSnapshot = () => typeof CSS !== "undefined" && "highlights" in CSS;
const getServerSnapshot = () => false;

export function useHighlightSupported(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
