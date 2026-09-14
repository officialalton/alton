import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// R9 — 커리큘럼 콘텐츠 기반 1/N(docs/superpowers/plans/2026-09-07-curriculum-content-foundation.md
// Task 1): subject_keywords 및 단원/교재조각/문제 ↔ 키워드 관계 테이블을 로컬
// Postgres에 직접 psql로 검증한다(session-annotation-events.integration.test.ts 등과
// 동일한 패턴 — RLS/트리거는 mocked 클라이언트로는 검증할 수 없다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // 관리자 (seed)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 선생님 (seed)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const SUBJECT_MATH_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (seed)
const SUBJECT_RW_ID = "eeeeeeee-0000-0000-0000-000000000002"; // SAT Reading & Writing (seed)

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

function asUserExpectError(userId: string, sql: string): string {
  return psqlExpectError(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

let unitId: string;

function makeUnit(subjectId: string, label: string): string {
  return psql(
    `insert into subject_template_units (subject_id, position, unit_title)
     values ('${subjectId}', ${Math.floor(Math.random() * 1000000) + 100}, '${label}') returning id;`
  );
}


describe("subject_keywords 사전 — 과목별 고유성", () => {
  it("같은 과목 안에서는 정규화(trim/lower) 라벨 중복이 실패한다", () => {
    const label = `함수 ${Date.now()}`;
    const first = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '${label}') returning id;`
    );
    expect(first).toMatch(/^[0-9a-f-]{36}$/);

    const err = psqlExpectError(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '  ${label.toUpperCase()}  ');`
    );
    expect(err).toMatch(/duplicate key|unique/i);
  });

  it("같은 라벨이라도 다른 과목이면 허용된다", () => {
    const label = `공통라벨 ${Date.now()}`;
    const mathId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '${label}') returning id;`
    );
    const rwId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_RW_ID}', '${label}') returning id;`
    );
    expect(mathId).not.toBe(rwId);
  });

  it("정규화 라벨은 trim + lower로 트리거가 채운다", () => {
    const raw = `  Mixed Case ${Date.now()}  `;
    const id = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '${raw}') returning id;`
    );
    const normalized = psql(`select normalized_label from subject_keywords where id = '${id}';`);
    expect(normalized).toBe(raw.trim().toLowerCase());
  });
});

// R9 corrective 2 (제품 오너 리뷰): 태깅(키워드 관계)은 저작 편의 기능이지
// 공개/확정 게이트가 아니다 — draft 섹션/미확정 문제에도 태깅할 수 있어야
// 하고, 나중에 unpublish/unconfirm 되어도 관계 행은 삭제되지 않아야 한다.
// "선택 가능(teaching-selectable)" 여부는 읽기 시점에
// curriculum_doc_section_keywords_selectable / problem_keywords_selectable
// 뷰가 published/confirmed를 검사해서 걸러낸다.
describe("선택 가능(teaching-selectable) 게이트는 쓰기가 아니라 읽기 시점(뷰)에 있다", () => {
  it("공개(published)되지 않은 교재의 섹션에도 키워드를 태깅할 수 있다(저작 편의 — 공개 게이트 아님)", () => {
    unitId = makeUnit(SUBJECT_MATH_ID, `임시단원A ${Date.now()}`);
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('미공개 교재', '${SUBJECT_MATH_ID}', '${unitId}', 'admin', 'draft') returning id;`
    );
    const sectionId = psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '섹션1', '본문') returning id;`
    );
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-미공개 ${Date.now()}') returning id;`
    );

    const relId = psql(
      `insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}') returning section_id;`
    );
    expect(relId).toBe(sectionId);

    // 태깅에는 성공했지만 draft이므로 선택 가능 뷰에는 보이지 않는다.
    const selectable = psql(
      `select count(*) from curriculum_doc_section_keywords_selectable where section_id = '${sectionId}';`
    );
    expect(selectable).toBe("0");
  });

  it("확정(confirmed)되지 않은 문제에도 키워드를 태깅할 수 있다(저작 편의 — 확정 게이트 아님)", () => {
    const problemId = psql(
      `insert into problems (format, subject_id, status, created_by)
       values ('mc', '${SUBJECT_MATH_ID}', 'draft', '${ADMIN_ID}') returning id;`
    );
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-draft문제 ${Date.now()}') returning id;`
    );
    const relId = psql(
      `insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') returning problem_id;`
    );
    expect(relId).toBe(problemId);

    const selectable = psql(
      `select count(*) from problem_keywords_selectable where problem_id = '${problemId}';`
    );
    expect(selectable).toBe("0");
  });

  // 회귀 테스트(제품 오너 지시한 정확한 시나리오): 관리자가 draft 섹션에 태깅 →
  // unpublish(또는 draft 유지) → 관계가 DB에 그대로 남아있는지 확인 → 그 draft
  // 콘텐츠가 "선택 가능" 뷰에는 안 보이는지 확인 → publish → 같은 관계가 재태깅
  // 없이 그대로 선택 가능 뷰에 나타나는지 확인.
  it("draft에 태깅 → unpublish해도 관계 보존 → 선택 가능 뷰에는 미노출 → publish하면 재태깅 없이 노출", () => {
    unitId = makeUnit(SUBJECT_MATH_ID, `임시단원C ${Date.now()}`);
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('회귀테스트 교재', '${SUBJECT_MATH_ID}', '${unitId}', 'admin', 'draft') returning id;`
    );
    const sectionId = psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '섹션1', '본문') returning id;`
    );
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-회귀 ${Date.now()}') returning id;`
    );

    // 1) draft 상태에서 태깅
    psql(
      `insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}');`
    );
    expect(
      psql(`select count(*) from curriculum_doc_section_keywords where section_id = '${sectionId}';`)
    ).toBe("1");
    expect(
      psql(`select count(*) from curriculum_doc_section_keywords_selectable where section_id = '${sectionId}';`)
    ).toBe("0");

    // 2) publish했다가 다시 unpublish(draft로 되돌림) — 관계가 삭제되지 않는지 확인
    psql(`update curriculum_docs set status = 'published' where id = '${docId}';`);
    psql(`update curriculum_docs set status = 'draft' where id = '${docId}';`);
    expect(
      psql(`select count(*) from curriculum_doc_section_keywords where section_id = '${sectionId}';`)
    ).toBe("1");
    expect(
      psql(`select count(*) from curriculum_doc_section_keywords_selectable where section_id = '${sectionId}';`)
    ).toBe("0");

    // 3) publish — 재태깅 없이 같은 관계가 선택 가능 뷰에 나타난다
    psql(`update curriculum_docs set status = 'published' where id = '${docId}';`);
    const selectableRow = psql(
      `select keyword_id from curriculum_doc_section_keywords_selectable where section_id = '${sectionId}';`
    );
    expect(selectableRow).toBe(keywordId);
  });

  it("draft 문제에 태깅 → unconfirm해도 관계 보존 → 선택 가능 뷰에는 미노출 → confirm하면 재태깅 없이 노출", () => {
    const problemId = psql(
      `insert into problems (format, subject_id, status, created_by)
       values ('mc', '${SUBJECT_MATH_ID}', 'draft', '${ADMIN_ID}') returning id;`
    );
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-문제회귀 ${Date.now()}') returning id;`
    );

    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
    expect(psql(`select count(*) from problem_keywords where problem_id = '${problemId}';`)).toBe("1");
    expect(
      psql(`select count(*) from problem_keywords_selectable where problem_id = '${problemId}';`)
    ).toBe("0");

    psql(`update problems set status = 'confirmed' where id = '${problemId}';`);
    psql(`update problems set status = 'draft' where id = '${problemId}';`);
    expect(psql(`select count(*) from problem_keywords where problem_id = '${problemId}';`)).toBe("1");
    expect(
      psql(`select count(*) from problem_keywords_selectable where problem_id = '${problemId}';`)
    ).toBe("0");

    psql(`update problems set status = 'confirmed' where id = '${problemId}';`);
    const selectableRow = psql(
      `select keyword_id from problem_keywords_selectable where problem_id = '${problemId}';`
    );
    expect(selectableRow).toBe(keywordId);
  });
});

describe("RLS — 관리자만 키워드 카탈로그를 쓸 수 있다", () => {
  it("관리자는 키워드를 만들 수 있다", () => {
    const label = `관리자생성 ${Date.now()}`;
    const id = asUser(
      ADMIN_ID,
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '${label}') returning id;`
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("선생님은 키워드를 만들 수 없다(RLS 거부)", () => {
    const label = `선생님시도 ${Date.now()}`;
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '${label}');`
    );
    expect(err).toMatch(/row-level security|policy/i);
  });

  it("학생은 키워드를 만들 수 없다(RLS 거부)", () => {
    const label = `학생시도 ${Date.now()}`;
    const err = asUserExpectError(
      STUDENT_ID,
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '${label}');`
    );
    expect(err).toMatch(/row-level security|policy/i);
  });

  it("선생님은 단원↔키워드 관계를 쓸 수 없다(RLS 거부)", () => {
    const unit = makeUnit(SUBJECT_MATH_ID, `RLS단원 ${Date.now()}`);
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', 'RLS테스트키워드 ${Date.now()}') returning id;`
    );
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unit}', '${keywordId}');`
    );
    expect(err).toMatch(/row-level security|policy/i);
  });
});

describe("교차 과목 태깅 방지", () => {
  it("단원과 다른 과목의 키워드는 연결할 수 없다", () => {
    const unit = makeUnit(SUBJECT_MATH_ID, `교차과목단원 ${Date.now()}`);
    const rwKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_RW_ID}', '교차과목키워드 ${Date.now()}') returning id;`
    );
    const err = psqlExpectError(
      `insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unit}', '${rwKeywordId}');`
    );
    expect(err).toMatch(/같은 과목이어야/);
  });
});
