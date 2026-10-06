// 2026-09-10(P1-3) — 관리자 탭 id 목록의 단일 진실 소스. admin/page.tsx(서버
// 컴포넌트, searchParams.tab 기준으로 로더를 게이팅)와 AdminShell.tsx(클라이언트,
// activeTab 상태)가 서로 다른 판정 로직을 쓰면 새로고침/뒤로가기/직접 URL 진입 시
// "탭은 A인데 데이터는 B" 어긋남이 생길 수 있어, 유효성 판정 함수까지 여기서
// 공유한다.

export const ADMIN_NAV_TAB_IDS = [
  "home",
  "users",
  // 2026-10-06 Free Accounts — 무료 회원 목록·상세(점수 통계)·Analytics. 옛 id "free-members"는 alias.
  "free-accounts",
  "matching",
  "consult",
  "catalog",
  // P2 3차 — 문제은행. 교재와 독립된 진입점이라 커리큘럼 바로 옆 콘텐츠 그룹에 둔다.
  "problem-bank",
  // 2026-09-19 — 고정형 모의고사 V1. 문제은행 콘텐츠 그룹 바로 옆에 둔다(같은
  // 문제은행 공개 문항을 재료로 쓰는 화면이라 인접 배치).
  "mock-exam",
  // 2026-09-30 — 문제 오류 신고 내역·통계(문제은행 '신고' 탭에서 이전).
  "error-reports",
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
  // 2026-09-22(컨설턴트 포지션) — 관리자 전원이 쓴다(마스터 전용 아님 —
  // 학생 배정은 운영 업무).
  "consultants",
  // 관리자 포털 정리 항목 2(2026-09-23) — 관리자<->선생님/컨설턴트 내부
  // 메신저. 컨설턴트 서브탭은 기존 Consultants 탭 안에 있던 내부 문의를
  // 옮겨온 것(같은 테이블·같은 액션).
  "messenger",
] as const;

// "개발 로그"는 내비게이션에는 없지만 ?tab=devlog 직접 접근으로 열람 가능한
// 내부 전용 경로다(2026-09-10 UI/UX 리뷰 지적).
export const ADMIN_HIDDEN_TAB_IDS = ["devlog"] as const;

export const ADMIN_TAB_IDS = [...ADMIN_NAV_TAB_IDS, ...ADMIN_HIDDEN_TAB_IDS] as const;

export type AdminTabId = (typeof ADMIN_TAB_IDS)[number];

const VALID_TAB_ID_SET: ReadonlySet<string> = new Set(ADMIN_TAB_IDS);

// 2026-09-29 — Inquiries 탭은 Messenger(가족 채널)로 통합됐다. 옛 북마크·알림 링크
// (?tab=inquiry)는 Messenger로 보낸다(AdminShell이 raw 값으로 '가족' 서브탭을 연다).
export const LEGACY_INQUIRY_TAB_ID = "inquiry";

// 2026-10-06 — 옛 "Free Members" 탭 id(?tab=free-members) 북마크는 Free Accounts로 보낸다.
export const LEGACY_FREE_MEMBERS_TAB_ID = "free-members";

/** 알 수 없거나 없는 tab 값은 항상 "home"으로 정규화한다. */
export function resolveAdminTab(tab: string | undefined | null): AdminTabId {
  if (tab === LEGACY_INQUIRY_TAB_ID) return "messenger";
  if (tab === LEGACY_FREE_MEMBERS_TAB_ID) return "free-accounts";
  return tab && VALID_TAB_ID_SET.has(tab) ? (tab as AdminTabId) : "home";
}
