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

function makePublishedDoc(subjectId: string, unitId: string): { docId: string; sectionId: string } {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
     values ('키워드테스트 교재', '${subjectId}', '${unitId}', 'admin', 'published') returning id;`
  );
  const sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
     values ('${docId}', 1, '섹션1', '본문') returning id;`
  );
  return { docId, sectionId };
}

function makeConfirmedProblem(subjectId: string): string {
  return psql(
    `insert into problems (format, subject_id, status, created_by)
     values ('mc', '${subjectId}', 'confirmed', '${ADMIN_ID}') returning id;`
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

describe("선택 가능(teaching-selectable) 관계 — 공개/확정 콘텐츠만 허용", () => {
  it("공개(published)되지 않은 교재의 섹션은 키워드 관계에 들어갈 수 없다", () => {
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

    const err = psqlExpectError(
      `insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}');`
    );
    expect(err).toMatch(/공개\(published\)되지 않은/);
  });

  it("공개된 교재의 섹션은 키워드 관계에 들어갈 수 있고, published에서 벗어나면 관계가 정리된다", () => {
    unitId = makeUnit(SUBJECT_MATH_ID, `임시단원B ${Date.now()}`);
    const { docId, sectionId } = makePublishedDoc(SUBJECT_MATH_ID, unitId);
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-공개 ${Date.now()}') returning id;`
    );
    psql(
      `insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}');`
    );
    const countBefore = psql(
      `select count(*) from curriculum_doc_section_keywords where section_id = '${sectionId}';`
    );
    expect(countBefore).toBe("1");

    psql(`update curriculum_docs set status = 'draft' where id = '${docId}';`);
    const countAfter = psql(
      `select count(*) from curriculum_doc_section_keywords where section_id = '${sectionId}';`
    );
    expect(countAfter).toBe("0");
  });

  it("확정(confirmed)되지 않은 문제는 키워드 관계에 들어갈 수 없다", () => {
    const problemId = psql(
      `insert into problems (format, subject_id, status, created_by)
       values ('mc', '${SUBJECT_MATH_ID}', 'draft', '${ADMIN_ID}') returning id;`
    );
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-draft문제 ${Date.now()}') returning id;`
    );
    const err = psqlExpectError(
      `insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`
    );
    expect(err).toMatch(/확정\(confirmed\)되지 않은/);
  });

  it("확정된 문제는 키워드 관계에 들어갈 수 있고, draft로 되돌아가면 관계가 정리된다", () => {
    const problemId = makeConfirmedProblem(SUBJECT_MATH_ID);
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_MATH_ID}', '테스트키워드-confirmed문제 ${Date.now()}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
    expect(psql(`select count(*) from problem_keywords where problem_id = '${problemId}';`)).toBe("1");

    psql(`update problems set status = 'draft' where id = '${problemId}';`);
    expect(psql(`select count(*) from problem_keywords where problem_id = '${problemId}';`)).toBe("0");
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
