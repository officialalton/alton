import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// MST Phase 2 — 메타데이터·스냅샷·검증 확장의 DB 레벨 검증(psql, 모킹 없음).
// 재실행 안전: 실행마다 새 세트·새 문항·새 유사문항 그룹 키를 만들고, 단언은 이 파일이 만든 행으로 한정한다.
// 계획: docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md §3·§6 Phase 2.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = randomUUID().slice(0, 8);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}

let skillA: string;
let skillB: string;

function problem(n: number, opts: { domain: string; skill: string; difficulty?: string; group?: string; correctIndex?: number }) {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain, skill_code, similarity_group)
     values ('mc', 'P2 ${RUN} ${n}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${opts.domain}', '${opts.skill}', ${opts.group ? `'${opts.group}'` : "null"}) returning id;`,
  );
  psql(
    `update problem_versions set options = '["a","b","c","d"]'::jsonb, correct_index = ${opts.correctIndex ?? 0}, explanation = '해설',
       difficulty = '${opts.difficulty ?? "medium"}', status = 'published', published_at = now()
     where problem_id = '${problemId}' and version_no = 1;`,
  );
  const versionId = psql(`select id from problem_versions where problem_id = '${problemId}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${problemId}';`);
  return { problemId, versionId };
}

function newSet(label: string, rules: string): string {
  return psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, assembly_rules, created_by)
     values ('P2 ${label} ${RUN}', 'standard', 'draft', 'mst', '{"rw_m1":4,"rw_m2":0,"math_m1":0,"math_m2":0}', '${rules}', '${ADMIN_ID}') returning id;`,
  );
}
let posCounter = 0;
function addItem(setId: string, p: { problemId: string; versionId: string }, o: { domain: string; skill: string; difficulty?: string; module?: string }) {
  posCounter += 1;
  return psql(
    `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty, module_key)
     values ('${setId}', 'rw', ${posCounter}, '${p.problemId}', '${p.versionId}', '${o.domain}', '${o.skill}', '${o.difficulty ?? "medium"}', '${o.module ?? "rw_m1"}') returning id;`,
  );
}
const RULES = '{"skillMaxSharePct":50,"enforceM1Eligibility":true,"noSimilarGroupRepeat":true}';
const validate = (setId: string) => JSON.parse(psql(`select mock_exam_validate_mst_set('${setId}')::text;`));

beforeAll(() => {
  const codes = psql(`select code from problem_skill_codes order by code limit 2;`).split("\n");
  [skillA, skillB] = codes;
});

describe("배정 가능 플래그(difficulty 파생)", () => {
  it("easy·medium → M1/lower, medium·hard → higher", () => {
    const setId = newSet("flags", "{}");
    const ids = (["easy", "medium", "hard"] as const).map((d, i) => {
      const p = problem(100 + i, { domain: "rw_craft_structure", skill: skillA, difficulty: d });
      return addItem(setId, p, { domain: "rw_craft_structure", skill: skillA, difficulty: d });
    });
    const rows = psql(`select difficulty || ':' || m1_eligible || ':' || m2_higher_eligible || ':' || m2_lower_eligible from mock_exam_set_items where id in ('${ids.join("','")}') order by difficulty;`).split("\n");
    expect(rows).toEqual(["easy:true:false:true", "hard:false:true:false", "medium:true:true:true"]);
  });
});

describe("스냅샷", () => {
  it("insert 시 채워지고 변경 불가; 원본 버전이 바뀌어도 채점·응시 화면은 스냅샷 기준", () => {
    const setId = newSet("snapshot", "{}");
    const p = problem(200, { domain: "rw_craft_structure", skill: skillA, correctIndex: 0 });
    const itemId = addItem(setId, p, { domain: "rw_craft_structure", skill: skillA });
    expect(psql(`select content_snapshot->>'correct_index' || '|' || (content_snapshot->>'passage') from mock_exam_set_items where id = '${itemId}';`)).toBe(`0|P2 ${RUN} 200`);
    expect(fails(() => psql(`update mock_exam_set_items set content_snapshot = '{}'::jsonb where id = '${itemId}';`))).toContain("스냅샷");
    expect(fails(() => psql(`update mock_exam_set_items set problem_version_id = '${p.versionId}' where id = '${itemId}';`))).toBe("");

    // 원본 버전 정답·지문을 바꿔도 스냅샷은 그대로: 응시 → 저장 채점은 옛 정답(0) 기준.
    psql(`update problem_versions set correct_index = 1, passage = '변경됨' where id = '${p.versionId}';`);
    psql(`update mock_exam_sets set readiness_status = 'ready' where id = '${setId}';`);
    // 정원 4개 미달이라 validate가 ready=false이므로 게이트를 통과할 수 있게 module_item_counts를 1로 맞춘다.
    psql(`update mock_exam_sets set module_item_counts = '{"rw_m1":1,"rw_m2":0,"math_m1":0,"math_m2":0}' where id = '${setId}';`);
    psql(`update mock_exam_sets set status = 'published' where id = '${setId}';`);
    const attemptId = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${STUDENT_ID}', '${setId}', 'assigned') returning id;`);
    asUser(STUDENT_ID, `select mock_exam_start_mst('${attemptId}');`);
    const st = asUser(STUDENT_ID, `select (s->'items'->0->>'passage') from mock_exam_mst_state('${attemptId}') s;`);
    expect(st).toBe(`P2 ${RUN} 200`);
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${itemId}', '0', null);`);
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${itemId}';`)).toBe("t");
  });
});

describe("mock_exam_validate_mst_set 확장", () => {
  it("skill 쏠림: 한 영역 4문항이 전부 같은 skill이어도 경고만(ready 유지), skillHardGate=true면 위반·ready=false", () => {
    const setId = newSet("skill-bad", RULES);
    for (let i = 0; i < 4; i++) {
      const p = problem(300 + i, { domain: "rw_craft_structure", skill: skillA });
      addItem(setId, p, { domain: "rw_craft_structure", skill: skillA });
    }
    const v = validate(setId);
    expect(v.ready).toBe(true);
    expect(v.skillViolations).toEqual([]);
    expect(v.skillWarnings).toHaveLength(1);
    expect(v.skillWarnings[0]).toMatchObject({ moduleKey: "rw_m1", skillCode: skillA, count: 4, cap: 2 });

    const hardId = newSet("skill-hard", '{"skillMaxSharePct":50,"skillHardGate":true}');
    for (let i = 0; i < 4; i++) {
      const p = problem(340 + i, { domain: "rw_craft_structure", skill: skillA });
      addItem(hardId, p, { domain: "rw_craft_structure", skill: skillA });
    }
    const h = validate(hardId);
    expect(h.ready).toBe(false);
    expect(h.skillViolations).toHaveLength(1);
    expect(h.skillWarnings).toEqual([]);
  });

  it("skill 균형: 2+2로 나뉘면 skill 위반 없음", () => {
    const setId = newSet("skill-ok", RULES);
    [skillA, skillA, skillB, skillB].forEach((sk, i) => {
      const p = problem(320 + i, { domain: "rw_craft_structure", skill: sk });
      addItem(setId, p, { domain: "rw_craft_structure", skill: sk });
    });
    const v = validate(setId);
    expect(v.skillViolations).toEqual([]);
    expect(v.skillWarnings).toEqual([]);
    expect(v.ready).toBe(true);
  });

  it("Module 1에 hard 문항 → 배정 불가 위반", () => {
    const setId = newSet("elig", RULES);
    [skillA, skillA, skillB, skillB].forEach((sk, i) => {
      const p = problem(340 + i, { domain: "rw_craft_structure", skill: sk, difficulty: i === 0 ? "hard" : "medium" });
      addItem(setId, p, { domain: "rw_craft_structure", skill: sk, difficulty: i === 0 ? "hard" : "medium" });
    });
    const v = validate(setId);
    expect(v.ready).toBe(false);
    expect(v.eligibilityViolations).toHaveLength(1);
    expect(v.eligibilityViolations[0].difficulty).toBe("hard");
  });

  it("같은 유사문항 그룹이 한 세트에 둘 → 위반", () => {
    const setId = newSet("sim", RULES);
    [skillA, skillA, skillB, skillB].forEach((sk, i) => {
      const p = problem(360 + i, { domain: "rw_craft_structure", skill: sk, group: i < 2 ? `grp-${RUN}` : undefined });
      addItem(setId, p, { domain: "rw_craft_structure", skill: sk });
    });
    const v = validate(setId);
    expect(v.ready).toBe(false);
    expect(v.similarityViolations).toEqual([{ similarityGroup: `grp-${RUN}`, count: 2 }]);
  });

  it("규칙이 없는 세트(Phase 1)는 추가 검증을 강제하지 않는다", () => {
    const setId = newSet("legacy", "{}");
    for (let i = 0; i < 4; i++) {
      const p = problem(380 + i, { domain: "rw_craft_structure", skill: skillA, difficulty: "hard" });
      addItem(setId, p, { domain: "rw_craft_structure", skill: skillA, difficulty: "hard" });
    }
    const v = validate(setId);
    expect(v.skillViolations).toEqual([]);
    expect(v.eligibilityViolations).toEqual([]);
    expect(v.ready).toBe(true);
  });
});

describe("집계 함수", () => {
  it("노출 이력·세트 문항 수 집계는 service_role 전용이고 값이 맞다", () => {
    const setId = newSet("counts", "{}");
    const p = problem(400, { domain: "rw_craft_structure", skill: skillA });
    addItem(setId, p, { domain: "rw_craft_structure", skill: skillA });
    expect(psql(`select set_count || '|' || attempt_count from mock_exam_problem_exposure_counts() where problem_id = '${p.problemId}';`)).toBe("1|0");
    expect(psql(`select rw_count || '|' || math_count from mock_exam_set_item_counts() where exam_set_id = '${setId}';`)).toBe("1|0");
    expect(fails(() => asUser(STUDENT_ID, `select * from mock_exam_problem_exposure_counts();`))).toContain("permission denied");
    expect(fails(() => asUser(STUDENT_ID, `select * from mock_exam_set_item_counts();`))).toContain("permission denied");
  });
});
