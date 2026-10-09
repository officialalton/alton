"use client";

// 화면을 보는 사람(뷰어) 본인의 시간대 — 포털 셸(학생/학부모/선생님/컨설턴트/관리자/세션뷰)마다
// 서버 페이지가 이미 읽은 profiles.timezone 해석 결과를 prop으로 한 번 내려준다.
// 서버 렌더와 클라이언트 hydrate가 같은 문자열을 받으므로 날짜 출력이 항상 같다(hydration #418 방지).
// Provider 밖(테스트·단독 렌더)에서는 DISPLAY_TIMEZONE으로 폴백한다.

import { createContext, useContext, type ReactNode } from "react";
import { DISPLAY_TIMEZONE } from "@/lib/format-datetime";

const ViewerTimezoneContext = createContext<string>(DISPLAY_TIMEZONE);

export function ViewerTimezoneProvider({ timezone, children }: { timezone: string | null | undefined; children: ReactNode }) {
  return <ViewerTimezoneContext.Provider value={timezone || DISPLAY_TIMEZONE}>{children}</ViewerTimezoneContext.Provider>;
}

export function useViewerTimezone(): string {
  return useContext(ViewerTimezoneContext);
}
