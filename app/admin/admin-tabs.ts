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
  // P2 3차 — 문제은행. 교재와 독립된 진입점이라 커리큘럼 바로 옆 콘텐츠 그룹에 둔다.
  "problem-bank",
  // 2026-09-19 — 고정형 모의고사 V1. 문제은행 콘텐츠 그룹 바로 옆에 둔다(같은
  // 문제은행 공개 문항을 재료로 쓰는 화면이라 인접 배치).
  "mock-exam",
  "entitlements",
  "unified-schedule",
  "booking",
  "payouts",
  // P4-3 — 문서 아카이브. 운영 흐름(신규·문의·일정·예약) 뒤, 시스템성
  // 탭(Workspace) 앞에 둔다.
  "documents",
  "workspace",
  // 2026-09-22(관리자 계정 구조) — 마스터(official@alton.education)만 보이는
  // 관리자 등급·권한 셋업 화면. AdminShell이 마스터가 아니면 이 nav 항목을
  // 숨긴다(admin-accounts-data.ts의 검사가 최종 방어선).
  "admin-accounts",
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
