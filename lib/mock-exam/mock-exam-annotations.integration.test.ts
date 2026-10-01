import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// 2026-10-02 — 20262002000000(하이라이트·메모·소거 저장/잠금/읽기 권한) DB 검증. 세트 구성은 mock-exam-mst-flow.integration.test.ts 와 같다(psql + set role authenticated).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}

let examSetId: string;
let attemptId: string;
const itemsByModule: Record<string, string[]> = {};

function publishedProblem(n: number, format: "mc" | "spr", domain: string): { problemId: string; versionId: string } {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('${format}', 'MST annotations 통합테스트 ${n}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${domain}') returning id;`,
  );
  const content =
    format === "mc"
      ? `options = '["a","b","c","d"]'::jsonb, correct_index = 0`
      : `answers = '["3.25","13/4"]'::jsonb`;
  psql(`update problem_versions set ${content}, explanation = '해설', explanation_en = 'English explanation', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${problemId}' and version_no = 1;`);
  const versionId = psql(`select id from problem_versions where problem_id = '${problemId}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${problemId}';`);
  return { problemId, versionId };
}

beforeAll(() => {
  // 앞선 실행이 남긴 같은 세트 계열 응시가 있으면 unique(student, set_group)에 걸리므로 매번 새 세트를 만든다.
  examSetId = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by)
     values ('MST annotations 통합테스트 ${Date.now()}', 'standard', 'draft', 'mst', '{"rw_m1":2,"rw_m2":2,"math_m1":2,"math_m2":2}', '${ADMIN_ID}') returning id;`,
  );
  const plan: { key: string; section: "rw" | "math"; pos: number; format: "mc" | "spr"; domain: string }[] = [
    { key: "rw_m1", section: "rw", pos: 1, format: "mc", domain: "rw_craft_structure" },
    { key: "rw_m1", section: "rw", pos: 2, format: "mc", domain: "rw_craft_structure" },
    { key: "rw_m2", section: "rw", pos: 3, format: "mc", domain: "rw_information_ideas" },
    { key: "rw_m2", section: "rw", pos: 4, format: "mc", domain: "rw_information_ideas" },
    { key: "math_m1", section: "math", pos: 1, format: "mc", domain: "algebra" },
    { key: "math_m1", section: "math", pos: 2, format: "spr", domain: "algebra" },
    { key: "math_m2", section: "math", pos: 3, format: "mc", domain: "advanced_math" },
    { key: "math_m2", section: "math", pos: 4, format: "spr", domain: "advanced_math" },
  ];
  plan.forEach((p, i) => {
    const { problemId, versionId } = publishedProblem(i, p.format, p.domain);
    const id = psql(
      `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty, module_key)
       values ('${examSetId}', '${p.section}', ${p.pos}, '${problemId}', '${versionId}', '${p.domain}', 'medium', '${p.key}') returning id;`,
    );
    (itemsByModule[p.key] ??= []).push(id);
  });
  // 출시 조건: 정원 검증 통과 → ready → 공개 → 배정(ready가 아니면 배정 트리거가 거부).
  expect(psql(`select (mock_exam_validate_mst_set('${examSetId}')->>'ready');`)).toBe("true");
  psql(`update mock_exam_sets set readiness_status = 'ready', readiness_checked_at = now() where id = '${examSetId}';`);
  psql(`update mock_exam_sets set status = 'published' where id = '${examSetId}';`);
  attemptId = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${STUDENT_ID}', '${examSetId}', 'assigned') returning id;`);
});

const HL = `'[{"id":"h1","start":0,"end":5,"text":"MST g","note":"one line"}]'::jsonb`;
const OTHER_STUDENT = "cccccccc-0000-0000-0000-000000000002";

describe("모의고사 하이라이트·메모·소거 저장", () => {
  it("본인은 현재 모듈 문항에 저장하고 다시 읽는다", () => {
    const [i1] = itemsByModule.rw_m1;
    asUser(STUDENT_ID, `select mock_exam_start_mst('${attemptId}'); select save_mock_exam_annotations('${attemptId}', '${i1}', ${HL}, '[1,3]'::jsonb);`);
    expect(asUser(STUDENT_ID, `select load_mock_exam_annotations('${attemptId}', '${i1}')->'highlights'->0->>'note';`)).toBe("one line");
    expect(asUser(STUDENT_ID, `select load_mock_exam_annotations('${attemptId}', '${i1}')->>'eliminated';`)).toBe("[1, 3]");
    expect(asUser(STUDENT_ID, `select load_mock_exam_annotations('${attemptId}', '${itemsByModule.rw_m1[1]}')->>'highlights';`)).toBe("[]");
  });

  it("다른 학생은 쓰기·읽기 모두 거부, 테이블 직접 접근도 막힌다", () => {
    const [i1] = itemsByModule.rw_m1;
    expect(fails(() => asUser(OTHER_STUDENT, `select save_mock_exam_annotations('${attemptId}', '${i1}', '[]'::jsonb);`))).toContain("본인 응시만");
    expect(fails(() => asUser(OTHER_STUDENT, `select load_mock_exam_annotations('${attemptId}', '${i1}');`))).toContain("볼 권한이 없습니다");
    expect(asUser(OTHER_STUDENT, `select count(*) from mock_exam_annotations;`)).toBe("0");
    expect(asUser(STUDENT_ID, `select count(*) from mock_exam_annotations;`)).toBe("0");
  });

  it("형식 위반(120자 초과 메모·범위 오류·소거 번호)과 다음 모듈 문항은 거부", () => {
    const [i1] = itemsByModule.rw_m1;
    const [m2] = itemsByModule.rw_m2;
    const longNote = `'[{"id":"h","start":0,"end":3,"text":"abc","note":"${"x".repeat(121)}"}]'::jsonb`;
    expect(fails(() => asUser(STUDENT_ID, `select save_mock_exam_annotations('${attemptId}', '${i1}', ${longNote});`))).toContain("형식");
    expect(fails(() => asUser(STUDENT_ID, `select save_mock_exam_annotations('${attemptId}', '${i1}', '[{"id":"h","start":5,"end":2,"text":"a"}]'::jsonb);`))).toContain("형식");
    expect(fails(() => asUser(STUDENT_ID, `select save_mock_exam_annotations('${attemptId}', '${i1}', '[]'::jsonb, '[9]'::jsonb);`))).toContain("형식");
    expect(fails(() => asUser(STUDENT_ID, `select save_mock_exam_annotations('${attemptId}', '${m2}', '[]'::jsonb);`))).toContain("제출된 모듈");
  });

  it("모듈 제출 후 쓰기 거부, 저장분은 그대로 읽힌다 — 결과 열람은 본인·관리자", () => {
    const [i1] = itemsByModule.rw_m1;
    asUser(STUDENT_ID, `select mock_exam_submit_module('${attemptId}', 'rw_m1');`);
    expect(fails(() => asUser(STUDENT_ID, `select save_mock_exam_annotations('${attemptId}', '${i1}', '[]'::jsonb);`))).toContain("제출된 모듈");
    expect(asUser(STUDENT_ID, `select load_mock_exam_annotations('${attemptId}', '${i1}')->'highlights'->0->>'text';`)).toBe("MST g");
    expect(asUser(ADMIN_ID, `select load_mock_exam_annotations('${attemptId}', '${i1}')->'highlights'->0->>'id';`)).toBe("h1");
  });

  it("시험 제출·채점 후에도 쓰기 거부", () => {
    const [i1] = itemsByModule.rw_m1;
    asUser(STUDENT_ID, `select mock_exam_submit_module('${attemptId}', 'rw_m2'); select mock_exam_submit_module('${attemptId}', 'break');
      select mock_exam_submit_module('${attemptId}', 'math_m1'); select mock_exam_submit_module('${attemptId}', 'math_m2');`);
    expect(fails(() => asUser(STUDENT_ID, `select save_mock_exam_annotations('${attemptId}', '${i1}', '[]'::jsonb);`))).toContain("제출한 시험");
  });
});
