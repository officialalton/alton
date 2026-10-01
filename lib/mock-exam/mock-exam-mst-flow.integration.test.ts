import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// MST(4모듈) Phase 1 — 시작 → 모듈 잠금 → 시간 만료 자동 제출 → 휴식 → Math → 채점 완료 흐름의
// DB 레벨(RLS·RPC) 검증. mock-exam-attempt-flow.integration.test.ts 와 같은 방식(psql +
// set role authenticated + request.jwt.claim.sub)으로 실제 로컬 DB를 태운다(모킹 없음).
// 계획: docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md §7 테스트 계획 3·4항.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";
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
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('${format}', 'MST 통합테스트 ${n}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${domain}') returning id;`,
  );
  const content =
    format === "mc"
      ? `options = '["a","b","c","d"]'::jsonb, correct_index = 0`
      : `answers = '["3.25","13/4"]'::jsonb`;
  psql(`update problem_versions set ${content}, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${problemId}' and version_no = 1;`);
  const versionId = psql(`select id from problem_versions where problem_id = '${problemId}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${problemId}';`);
  return { problemId, versionId };
}

beforeAll(() => {
  // 앞선 실행이 남긴 같은 세트 계열 응시가 있으면 unique(student, set_group)에 걸리므로 매번 새 세트를 만든다.
  examSetId = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by)
     values ('MST 통합테스트 ${Date.now()}', 'standard', 'draft', 'mst', '{"rw_m1":2,"rw_m2":2,"math_m1":2,"math_m2":2}', '${ADMIN_ID}') returning id;`,
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

describe("MST 응시 흐름", () => {
  it("시작 전: 학생 상세에 문항 0개, format='mst'", () => {
    const row = asUser(STUDENT_ID, `select (d->>'format') || '|' || jsonb_array_length(d->'items') from mock_exam_attempt_detail('${attemptId}') d;`);
    expect(row).toBe("mst|0");
  });

  it("시작(멱등): 모듈 5개 생성, rw_m1 시작, 상태에 현재 모듈 문항만 정답 없이 내려온다", () => {
    asUser(STUDENT_ID, `select mock_exam_start_mst('${attemptId}'); select mock_exam_start_mst('${attemptId}');`);
    expect(psql(`select status || '|' || current_module from mock_exam_attempts where id = '${attemptId}';`)).toBe("in_progress|rw_m1");
    expect(psql(`select count(*) from mock_exam_attempt_modules where attempt_id = '${attemptId}';`)).toBe("5");
    const st = asUser(
      STUDENT_ID,
      `select jsonb_array_length(s->'items') || '|' || coalesce(s->'items'->0->>'correctIndex', 'null') || '|' || (s->'modules'->0->>'remainingSeconds')::int::text from mock_exam_mst_state('${attemptId}') s;`,
    );
    const [count, masked, remaining] = st.split("|");
    expect(count).toBe("2");
    expect(masked).toBe("null");
    expect(Number(remaining)).toBeGreaterThan(1900);
    expect(Number(remaining)).toBeLessThanOrEqual(1920);
  });

  it("다른 학생·타인은 시작·상태 조회 불가", () => {
    expect(fails(() => asUser("cccccccc-0000-0000-0000-000000000002", `select mock_exam_start_mst('${attemptId}');`))).toContain("본인 응시만");
    expect(fails(() => asUser("cccccccc-0000-0000-0000-000000000002", `select mock_exam_mst_state('${attemptId}');`))).toContain("권한");
  });

  it("답 저장·표시는 현재 모듈에서만; 고정형 submit은 거부", () => {
    const [i1] = itemsByModule.rw_m1;
    const [m2] = itemsByModule.rw_m2;
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${i1}', '0', 5); select mock_exam_toggle_flag('${attemptId}', '${i1}', true);`);
    expect(psql(`select correct || '|' || flagged from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${i1}';`)).toBe("true|true");
    expect(fails(() => asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${m2}', '0', null);`))).toContain("제출된 모듈");
    expect(fails(() => asUser(STUDENT_ID, `select mock_exam_submit('${attemptId}');`))).toContain("모듈 단위로");
  });

  it("모듈 제출 2회 → 한 번만 잠기고 rw_m2 시작; 잠긴 모듈 쓰기 거부", () => {
    const [i1] = itemsByModule.rw_m1;
    asUser(STUDENT_ID, `select mock_exam_submit_module('${attemptId}', 'rw_m1'); select mock_exam_submit_module('${attemptId}', 'rw_m1');`);
    expect(psql(`select current_module from mock_exam_attempts where id = '${attemptId}';`)).toBe("rw_m2");
    expect(psql(`select locked || '|' || auto_submitted || '|' || raw_correct_count from mock_exam_attempt_modules where attempt_id = '${attemptId}' and module_key = 'rw_m1';`)).toBe("true|false|1");
    expect(psql(`select count(*) from mock_exam_attempt_modules where attempt_id = '${attemptId}' and locked;`)).toBe("1");
    expect(fails(() => asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${i1}', '1', null);`))).toContain("제출된 모듈");
    expect(fails(() => asUser(STUDENT_ID, `select mock_exam_toggle_flag('${attemptId}', '${i1}', false);`))).toContain("제출된 모듈");
  });

  it("시간 만료: 다음 상태 조회에서 자동 제출·잠금 후 휴식으로 넘어간다", () => {
    psql(`update mock_exam_attempt_modules set ends_at = now() - interval '1 second' where attempt_id = '${attemptId}' and module_key = 'rw_m2';`);
    const st = asUser(STUDENT_ID, `select (s->>'currentModule') || '|' || jsonb_array_length(s->'items') from mock_exam_mst_state('${attemptId}') s;`);
    expect(st).toBe("break|0");
    expect(psql(`select locked || '|' || auto_submitted from mock_exam_attempt_modules where attempt_id = '${attemptId}' and module_key = 'rw_m2';`)).toBe("true|true");
  });

  it("진행 중 가시성: 교사는 전체 문항, 보호자는 현재 모듈(휴식이라 0개)", () => {
    expect(asUser(TEACHER_ID, `select jsonb_array_length(d->'items') from mock_exam_attempt_detail('${attemptId}') d;`)).toBe("8");
    expect(asUser(GUARDIAN_ID, `select jsonb_array_length(d->'items') from mock_exam_attempt_detail('${attemptId}') d;`)).toBe("0");
  });

  it("휴식 조기 종료 → Math M1, SPR 정규화 채점(26/8 = 3.25), 끝까지 제출하면 graded", () => {
    asUser(STUDENT_ID, `select mock_exam_submit_module('${attemptId}', 'break');`);
    expect(psql(`select current_module from mock_exam_attempts where id = '${attemptId}';`)).toBe("math_m1");
    const spr = itemsByModule.math_m1[1];
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${spr}', ' 26/8 ', null);`);
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${spr}';`)).toBe("t");
    asUser(STUDENT_ID, `select mock_exam_submit_module('${attemptId}', 'math_m1'); select mock_exam_submit_module('${attemptId}', 'math_m2');`);
    expect(psql(`select status || '|' || (submitted_at is not null) || '|' || (graded_at is not null) from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded|true|true");
    expect(psql(`select count(*) from mock_exam_attempt_modules where attempt_id = '${attemptId}' and locked;`)).toBe("5");
    // 채점 완료 후 학생 상세에 전체 문항 + 정답 열람
    expect(asUser(STUDENT_ID, `select jsonb_array_length(d->'items') || '|' || (d->'items'->0->>'correctIndex' is not null) from mock_exam_attempt_detail('${attemptId}') d;`)).toBe("8|true");
    // 보드·목록 공용 summaries가 계속 동작
    expect(Number(asUser(STUDENT_ID, `select jsonb_array_length(to_jsonb(mock_exam_attempt_summaries('${STUDENT_ID}')));`))).toBeGreaterThan(0);
  });

  it("세트 안 문항 중복 없음(문항 수 = 고유 problem 수)", () => {
    expect(psql(`select count(*) || '|' || count(distinct problem_id) from mock_exam_set_items where exam_set_id = '${examSetId}';`)).toBe("8|8");
  });
});

describe("SPR 정규화 채점(_answer_auto_grade)", () => {
  const cases: [string, string][] = [
    ["3.25", "t"], ["13/4", "t"], ["3.250", "t"], ["26/8", "t"], ["03.25", "t"], [" 3.25 ", "t"],
    ["3.2", "f"], ["4", "f"], [".3", "f"],
  ];
  it.each(cases)("%s → %s (정답 3.25 / 13/4)", (given, expected) => {
    expect(psql(`select _answer_auto_grade('spr', '${given}', null, '["3.25","13/4"]');`)).toBe(expected);
  });
  it("무한소수 정답은 소수점 3자리 이상 절사·반올림 허용, 2자리는 불허", () => {
    expect(psql(`select _answer_auto_grade('spr', '.333', null, '["1/3"]');`)).toBe("t");
    expect(psql(`select _answer_auto_grade('spr', '0.3333', null, '["1/3"]');`)).toBe("t");
    expect(psql(`select _answer_auto_grade('spr', '0.33', null, '["1/3"]');`)).toBe("f");
    expect(psql(`select _answer_auto_grade('spr', '2/6', null, '["1/3"]');`)).toBe("t");
  });
  it("기존 동작 유지: mc 인덱스 일치, 빈 답 false, 문자열 정답 일치", () => {
    expect(psql(`select _answer_auto_grade('mc', '1', 1, null);`)).toBe("t");
    expect(psql(`select _answer_auto_grade('spr', '', null, '["1"]');`)).toBe("f");
    expect(psql(`select _answer_auto_grade('spr', 'x', null, '["x"]');`)).toBe("t");
    expect(psql(`select _answer_auto_grade('spr', '1', null, '[]');`)).toBe("");
  });
});
