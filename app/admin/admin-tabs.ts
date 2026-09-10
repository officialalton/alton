// 2026-09-10(P1-3) — 관리자 탭 id 목록의 단일 진실 소스. admin/page.tsx(서버
// 컴포넌트, searchParams.tab 기준으로 로더를 게이팅)와 AdminShell.tsx(클라이언트,
// activeTab 상태)가 서로 다른 판정 로직을 쓰면 새로고침/뒤로가기/직접 URL 진입 시
// "탭은 A인데 데이터는 B" 어긋남이 생길 수 있어, 유효성 판정 함수까지 여기서
// 공유한다.

export const ADMIN_NAV_TAB_IDS = [
  "home",
  "users",
  "matching",
  "consult",
  "inquiry",
  "catalog",
  "billing",
  "entitlements",
  "unified-schedule",
  "booking",
  "payouts",
  "workspace",
] as const;

// "개발 로그"는 내비게이션에는 없지만 ?tab=devlog 직접 접근으로 열람 가능한
// 내부 전용 경로다(2026-09-10 UI/UX 리뷰 지적).
export const ADMIN_HIDDEN_TAB_IDS = ["devlog"] as const;

export const ADMIN_TAB_IDS = [...ADMIN_NAV_TAB_IDS, ...ADMIN_HIDDEN_TAB_IDS] as const;

export type AdminTabId = (typeof ADMIN_TAB_IDS)[number];

const VALID_TAB_ID_SET: ReadonlySet<string> = new Set(ADMIN_TAB_IDS);

/** 알 수 없거나 없는 tab 값은 항상 "home"으로 정규화한다. */
export function resolveAdminTab(tab: string | undefined | null): AdminTabId {
  return tab && VALID_TAB_ID_SET.has(tab) ? (tab as AdminTabId) : "home";
}
