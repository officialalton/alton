import type { FeatureKey } from "./feature-access-keys";

/**
 * 2026-10-05 무료 학습 회원 S2 — 기능 키 ↔ 학생 포털 탭 ↔ 가드된 서버 액션 파일 표
 * (docs/briefs/2026-10-05-free-member-tutoring-design.md §2.1, 검증 항목 9.1-7).
 *
 * 이 표는 문서가 아니라 테스트 입력이다(lib/feature-access-guards.test.ts):
 *   - 표의 모든 액션 파일은 export된 async 함수마다 `requireStudentFeature("<키>")`를 거쳐야 한다
 *     (파일 안 헬퍼를 통한 호출 허용). 가드 없는 export가 생기면 테스트가 실패한다.
 *   - app/student/*-actions.ts 에 새 파일이 생기면 표에 없으므로 테스트가 실패한다.
 *   - 탭 매핑은 StudentShell.tsx 의 NAV_FEATURE 와 같아야 한다(메뉴 숨김·서버 가드·DB 가드가 같은 키).
 *
 * 학생이 호출하지만 의도적으로 표에 없는 경로:
 *   - app/complete-profile/actions.ts — 프로필 완성 게이트 자체(requireUser 가 /complete-profile 로 보내는 단계)라
 *     기능 키 이전 단계다. complete_student_profile RPC 가 본인만 허용.
 *   - app/session/[id]/*-actions.ts — 수업 세션 전용. 관계 기반 RLS(is_session_student_v3 등)가 막고 무료 회원은
 *     세션이 없다(브리프 §2.1 "가드 불필요, 테스트만").
 *   - lib/free-member-signup.ts — 가입/프로비저닝(프로필이 없는 단계).
 */
export type GuardedActionFile = {
  /** 저장소 루트 기준 경로 */
  file: string;
  /** 파일 기본 키 */
  key: FeatureKey;
  /** 함수별 예외 키(예: booking-actions.updateMyTimezone 은 account) */
  overrides?: Record<string, FeatureKey>;
};

export const GUARDED_ACTION_FILES: readonly GuardedActionFile[] = [
  { file: "app/student/board-actions.ts", key: "home" },
  { file: "app/student/booking-actions.ts", key: "lesson_booking", overrides: { updateMyTimezone: "account" } },
  { file: "app/student/chat-actions.ts", key: "teacher_chat" },
  { file: "app/student/consultant-messenger-actions.ts", key: "consultant_portal" },
  { file: "app/student/consultant-schedule-actions.ts", key: "consultant_portal" },
  { file: "app/student/credits-actions.ts", key: "credits" },
  { file: "app/student/curriculum-overlay-actions.ts", key: "course" },
  { file: "app/student/incident-report-actions.ts", key: "class" },
  { file: "app/student/memo-actions.ts", key: "class" },
  { file: "app/student/mock-exam-tab-actions.ts", key: "mock_exam" },
  { file: "app/student/review-actions.ts", key: "class" },
  { file: "app/student/stats-actions.ts", key: "class" },
  { file: "app/student/vocab-library-actions.ts", key: "vocab" },
  { file: "app/student/tutoring-actions.ts", key: "tutoring_info" },
  { file: "app/materials/asset-actions.ts", key: "materials_free" },
  { file: "lib/homework-batch-actions.ts", key: "homework" },
  { file: "lib/problem-notes-actions.ts", key: "mock_exam" },
  { file: "lib/timezone-actions.ts", key: "account" },
  { file: "lib/roadmap/actions.ts", key: "roadmap" },
  { file: "lib/universities/user-actions.ts", key: "college" },
  { file: "lib/problem-error-reports/actions.ts", key: "problem_report" },
  { file: "lib/mock-exam/attempt-actions.ts", key: "mock_exam" },
  { file: "lib/mock-exam/mst-actions.ts", key: "mock_exam" },
];

/** 기능 키 → 학생 포털 탭 id(StudentShell NAV_ITEMS). 탭이 없는 키는 null(계정 메뉴·세션 화면·안내 카드 등). */
export const FEATURE_NAV_TAB: Record<FeatureKey, string | null> = {
  account: null,
  problem_report: null,
  home: "home",
  mock_exam: "mock-exam",
  problem_log: "problemlog",
  vocab: "vocab",
  materials_free: "materials",
  tutoring_info: null,
  roadmap: "roadmap",
  course: "enrollment",
  class: "classes",
  teacher: "teacher",
  homework: "homework",
  lesson_booking: null,
  teacher_chat: null,
  consultant_portal: "consultant",
  credits: null,
  college: null,
  session: null,
};
