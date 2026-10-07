// 콘텐츠 복사 키트 공용 정의 — 내보내기·가져오기가 같은 목록·순서를 쓴다.
// 목록은 supabase/migrations 스키마의 FK를 따라 정했다(근거: docs/2026-10-08-production-launch-runbook.md 3절).
// 제외(의도): 사용자·테스트·결제·계약·응시(mock_exam_attempts/answers/…)·세션·과제·신고/판정(→ 검수자 이전 절차)·감사 이력.

export type TableSpec = {
  name: string;
  /** 기본 public. 검수자 키트는 auth 스키마도 쓴다. */
  schema?: string;
  /** 항상 빈 문자열로 바꾸는 컬럼(일회용 토큰 등). */
  blankCols?: string[];
  /** jsonb 컬럼에 병합할 값(예: raw_app_meta_data 에 external_reviewer 표시). */
  jsonMerge?: Record<string, Record<string, unknown>>;
  /** 대상에 같은 id 가 없을 수 있어 CLI 값으로 덮어쓰는 컬럼(--override table.col=uuid). */
  overridable?: string[];
  /** 정렬·중복 판정 기준 키. */
  pk: string[];
  /**
   * insert    : 없는 행만 추가(on conflict do nothing) — 재실행 안전.
   * reference : 마이그레이션이 이미 심는 참조 데이터(같은 pk). 없는 행만 추가, 있으면 건드리지 않고 값 차이를 경고.
   * replace   : 마이그레이션이 임의 uuid 로 심는 설정표 — 대상의 기존 행을 지우고 원본 행으로 교체(원본과 동일 uuid 유지).
   */
  mode: "insert" | "reference" | "replace";
  /** 항상 NULL 로 바꾸는 컬럼(대상에 없는 프로필·세션·교재 섹션 참조). */
  nullAlways?: string[];
  /** 기본으로 NULL 로 바꾸되 --keep-authors 이면 유지하는 작성자 컬럼(대상에 같은 profiles.id 가 있을 때만 쓸 것). */
  nullAuthors?: string[];
  /** 순환 FK 때문에 1차 적재에서 NULL 로 두고, 모든 행 적재 뒤 UPDATE 로 채우는 컬럼. */
  deferred?: string[];
};

export const CONTENT_TABLES: TableSpec[] = [
  { name: "problem_skill_codes", pk: ["code"], mode: "reference" },
  { name: "subjects", pk: ["id"], mode: "insert" },
  { name: "subject_template_units", pk: ["id"], mode: "insert" },
  { name: "subject_keywords", pk: ["id"], mode: "insert", nullAuthors: ["created_by"] },
  { name: "subject_template_unit_keywords", pk: ["unit_id", "keyword_id"], mode: "insert", nullAuthors: ["created_by"] },
  {
    name: "problems",
    pk: ["id"],
    mode: "insert",
    nullAlways: ["origin_session_id", "section_id"],
    nullAuthors: ["created_by", "difficulty_confirmed_by"],
    deferred: ["published_version_id"],
  },
  { name: "problem_versions", pk: ["id"], mode: "insert", nullAuthors: ["created_by", "published_by", "submitted_by"] },
  { name: "problem_keywords", pk: ["problem_id", "keyword_id"], mode: "insert", nullAuthors: ["created_by"] },
  { name: "mock_exam_sets", pk: ["id"], mode: "insert", nullAuthors: ["created_by", "published_by"] },
  { name: "mock_exam_set_items", pk: ["id"], mode: "insert" },
  { name: "mock_exam_domain_weights", pk: ["id"], mode: "replace" },
  { name: "mock_exam_difficulty_weights", pk: ["id"], mode: "replace" },
  { name: "mock_exam_routing_policies", pk: ["id"], mode: "replace", nullAuthors: ["created_by"] },
];

/** 적재 후 고아 행 검사(대상 DB 안에서). [자식 테이블, 자식 컬럼, 부모 테이블, 부모 컬럼] */
export const FK_CHECKS: [string, string, string, string][] = [
  ["subject_template_units", "subject_id", "subjects", "id"],
  ["subject_keywords", "subject_id", "subjects", "id"],
  ["subject_keywords", "unit_id", "subject_template_units", "id"],
  ["subject_template_unit_keywords", "unit_id", "subject_template_units", "id"],
  ["subject_template_unit_keywords", "keyword_id", "subject_keywords", "id"],
  ["problems", "subject_id", "subjects", "id"],
  ["problems", "skill_code", "problem_skill_codes", "code"],
  ["problems", "published_version_id", "problem_versions", "id"],
  ["problem_versions", "problem_id", "problems", "id"],
  ["problem_keywords", "problem_id", "problems", "id"],
  ["problem_keywords", "keyword_id", "subject_keywords", "id"],
  ["mock_exam_set_items", "exam_set_id", "mock_exam_sets", "id"],
  ["mock_exam_set_items", "problem_id", "problems", "id"],
  ["mock_exam_set_items", "problem_version_id", "problem_versions", "id"],
  ["mock_exam_set_items", "skill_code", "problem_skill_codes", "code"],
];

export const TEST_NAME_RE = /uat|test|테스트|sandbox|tmp/i;

// ---- 검수자 이전 키트(계정 + 검수 산출물). 콘텐츠 키트가 먼저 적재돼 있어야 한다. ----
export const REVIEWER_TABLES: TableSpec[] = [
  { name: "users", schema: "auth", pk: ["id"], mode: "insert", blankCols: ["confirmation_token", "recovery_token", "email_change_token_new", "email_change_token_current", "reauthentication_token", "phone_change_token"], jsonMerge: { raw_app_meta_data: { external_reviewer: true } } },
  { name: "identities", schema: "auth", pk: ["id"], mode: "insert" },
  { name: "profiles", pk: ["id"], mode: "insert", nullAlways: ["date_of_birth_verified_by", "admin_edited_by"] },
  { name: "students", pk: ["id"], mode: "insert" },
  { name: "student_terms_acceptances", pk: ["id"], mode: "insert" },
  { name: "problem_error_verdicts", pk: ["id"], mode: "insert", overridable: ["decided_by"] },
  { name: "problem_error_reports", pk: ["id"], mode: "insert", nullAlways: ["session_id", "mock_attempt_id", "homework_batch_id"] },
];

export const REVIEWER_FK_CHECKS: [string, string, string, string][] = [
  ["auth.identities", "user_id", "auth.users", "id"],
  ["profiles", "id", "auth.users", "id"],
  ["students", "id", "profiles", "id"],
  ["student_terms_acceptances", "student_id", "students", "id"],
  ["problem_error_verdicts", "decided_by", "profiles", "id"],
  ["problem_error_verdicts", "problem_id", "problems", "id"],
  ["problem_error_verdicts", "problem_version_id", "problem_versions", "id"],
  ["problem_error_reports", "reporter_id", "profiles", "id"],
  ["problem_error_reports", "problem_id", "problems", "id"],
  ["problem_error_reports", "problem_version_id", "problem_versions", "id"],
  ["problem_error_reports", "mock_set_item_id", "mock_exam_set_items", "id"],
  ["problem_error_reports", "resolved_verdict_id", "problem_error_verdicts", "id"],
];
