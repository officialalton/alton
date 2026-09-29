import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPerRunTeacher } from "@/test/per-run-teacher";
import { insertReservationInBand } from "@/test/reservation-slots";

// 문제 용도(usage_scope) + 유사문항 그룹 자동 부여 — DB 계약(2026-09-29).
// 실제 로컬 DB에 대해 실행하고, 이 파일이 만든 행(실행 ID RUN)만 만지며 afterAll 에서 정리한다.
// 재실행 안전: 세션·예약은 다른 통합 테스트처럼 원장 성격이라 남기되, 실행마다 전용 선생님·수강·키워드를 새로 만든다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `${Date.now()}`;

let TEACHER_ID: string;

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
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
/** 숫자를 글자로 바꿔 본문이 서로 다르게 만든다(자동 그룹은 숫자를 지운 본문으로 계산한다). */
const alpha = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)).repeat(3));

const createdProblems: string[] = [];
const createdSessions: string[] = [];
const createdUnits: string[] = [];
const createdSets: string[] = [];
let seq = 0;

/** 공개된 문제 하나(직접 SQL 픽스처 — usage_scope 지정). 키워드가 있으면 붙인다. */
function published(scope: "general" | "mock_exam" | "both", keywordId?: string, opts: { passage?: string; skill?: string } = {}): string {
  seq += 1;
  const passage = opts.passage ?? `Usage ${RUN} ${alpha(seq)} passage. Which choice is best?`;
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by, usage_scope, sat_domain, skill_code)
     values ('mc', ${q(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${scope}', 'rw_craft_structure', ${opts.skill ? q(opts.skill) : "'words_in_context'"}) returning id;`,
  );
  createdProblems.push(id);
  psql(
    `update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`,
  );
  const versionId = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${id}';`);
  if (keywordId) psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
  return id;
}

/** create_bank_problem RPC 로 만든 문제(용도 필수). */
function bank(scope: string | null, extra = ""): string {
  const s = scope === null ? "null" : q(scope);
  const id = psql(
    `select create_bank_problem('${SUBJECT_ID}', 'mc', '', '', 'medium', '${ADMIN_ID}', 'words_in_context', 'sat_rw', null, ${s}${extra});`,
  );
  createdProblems.push(id);
  return id;
}
function draft(problemId: string, passage: string, question: string | null = null) {
  return psql(
    `select save_problem_draft_version('${problemId}', ${q(passage)}, '["a","b","c","d"]'::jsonb, 0, '해설', 'medium', '${ADMIN_ID}', null, null, false, null, ${question ? q(question) : "null"});`,
  );
}
const group = (id: string) => psql(`select coalesce(similarity_group, '<null>') from problems where id = '${id}';`);

let keywordId: string;
let enrollmentId: string;
let overlayUnitId: string;

function newSession(band: string): string {
  const reservationId = insertReservationInBand(psql, { band: "problem-usage-scope", enrollmentId, teacherId: TEACHER_ID });
  void band;
  const id = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`,
  );
  createdSessions.push(id);
  return id;
}

let poolGeneral: string[];
let poolMock: string[];
let poolBoth: string[];

beforeAll(() => {
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: "usage-scope" });
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`,
  );
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`);
  keywordId = psql(`insert into subject_keywords (subject_id, label, normalized_label) values ('${SUBJECT_ID}', '용도범위테스트 ${RUN}', 'usagescope${RUN}') returning id;`);

  // 같은 키워드 풀: 일반용 3 · 모의고사용 3 · 기존(both) 2
  poolGeneral = [1, 2, 3].map(() => published("general", keywordId));
  poolMock = [1, 2, 3].map(() => published("mock_exam", keywordId));
  poolBoth = [1, 2].map(() => published("both", keywordId));

  // issue_homework_items 용 회차 사슬(수업 → 회차 → 키워드)
  const overlayId = psql(`insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  overlayUnitId = psql(`insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '용도 ${RUN}') returning id;`);
  psql(`insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);
}, 60_000);

afterAll(() => {
  const ids = createdProblems.map((i) => `'${i}'`).join(",") || "null";
  const sess = createdSessions.map((i) => `'${i}'`).join(",") || "null";
  const units = createdUnits.map((i) => `'${i}'`).join(",") || "null";
  const sets = createdSets.map((i) => `'${i}'`).join(",") || "null";
  psql(`delete from session_homework_items where session_id in (${sess}) or problem_id in (${ids});`);
  psql(`delete from mock_exam_set_items where exam_set_id in (${sets}) or problem_id in (${ids});`);
  psql(`delete from mock_exam_sets where id in (${sets});`);
  psql(`delete from subject_template_unit_problems where unit_id in (${units}) or problem_id in (${ids});`);
  psql(`delete from subject_template_units where id in (${units});`);
  psql(`delete from curriculum_unit_prep_items where content_id in (${ids});`);
  psql(`update problems set published_version_id = null where id in (${ids});`);
  psql(`delete from problem_versions where problem_id in (${ids});`);
  psql(`delete from problem_keywords where problem_id in (${ids});`);
  psql(`delete from problems where id in (${ids});`);
});

describe("생성: 용도는 필수이고 both 는 새 문제로 만들 수 없다", () => {
  it("용도 없이(null) 만들면 거절, both·엉뚱한 값도 거절, general·mock_exam 은 저장된다", () => {
    expect(fails(() => bank(null))).toContain("용도");
    expect(fails(() => bank("both"))).toContain("용도");
    expect(fails(() => bank("whatever"))).toContain("용도");
    const g = bank("general");
    const m = bank("mock_exam");
    expect(psql(`select usage_scope from problems where id = '${g}';`)).toBe("general");
    expect(psql(`select usage_scope from problems where id = '${m}';`)).toBe("mock_exam");
  });

  it("용도 없이 만들 수 있던 옛 5인수 오버로드는 없다", () => {
    expect(fails(() => psql(`select create_bank_problem('${SUBJECT_ID}', 'mc', 'x', 'y', '${ADMIN_ID}');`))).toContain("does not exist");
  });

  it("다른 값에서 both 로 되돌릴 수 없다(레거시 전용)", () => {
    const g = bank("general");
    expect(fails(() => psql(`update problems set usage_scope = 'both' where id = '${g}';`))).toContain("기존 문제 전용");
    // 레거시(both)는 나눌 수 있다.
    const legacy = published("both");
    psql(`update problems set usage_scope = 'general' where id = '${legacy}';`);
    expect(psql(`select usage_scope from problems where id = '${legacy}';`)).toBe("general");
  });

  it("직접 INSERT 는 default 로 both 가 된다(기존 데이터·시드 호환) — 앱 경로는 전부 RPC", () => {
    const id = psql(`insert into problems (format, subject_id, status, created_by) values ('mc', '${SUBJECT_ID}', 'draft', '${ADMIN_ID}') returning id;`);
    createdProblems.push(id);
    expect(psql(`select usage_scope from problems where id = '${id}';`)).toBe("both");
  });
});

describe("재분류 RPC·감사·권한", () => {
  it("일괄 재분류는 both 를 대상으로 못 하고, 바꾼 행만 세며, from→to·행위자·사유가 append-only 로 남는다", () => {
    const a = published("both");
    const b = published("both");
    expect(fails(() => psql(`select retag_problem_usage_scope(array['${a}']::uuid[], 'both', '${ADMIN_ID}');`))).toContain("일반용 또는 모의고사용");
    expect(psql(`select retag_problem_usage_scope(array['${a}','${b}']::uuid[], 'mock_exam', '${ADMIN_ID}', '테스트 ${RUN}');`)).toBe("2");
    // 같은 값으로 다시 하면 0 (멱등)
    expect(psql(`select retag_problem_usage_scope(array['${a}','${b}']::uuid[], 'mock_exam', '${ADMIN_ID}');`)).toBe("0");
    expect(psql(`select retag_problem_usage_scope(array['${a}']::uuid[], 'general', '${ADMIN_ID}');`)).toBe("1");
    const rows = psql(
      `select from_scope || '>' || to_scope || '|' || (changed_by = '${ADMIN_ID}')::text || '|' || coalesce(reason, '-') from problem_usage_scope_changes where problem_id = '${a}' order by changed_at, id;`,
    ).split("\n");
    expect(rows).toEqual([`both>mock_exam|true|테스트 ${RUN}`, "mock_exam>general|true|-"]);
    // 추가만 가능
    expect(fails(() => psql(`update problem_usage_scope_changes set to_scope = 'both' where problem_id = '${a}';`))).toContain("수정할 수 없습니다");
    // 직접 UPDATE 도 기록된다(행위자 없음)
    psql(`update problems set usage_scope = 'mock_exam' where id = '${a}';`);
    expect(psql(`select count(*) from problem_usage_scope_changes where problem_id = '${a}';`)).toBe("3");
  });

  it("학생은 usage_scope 를 읽을 수 있지만(무해한 메타데이터) similarity_group_manual·정답 컬럼·감사·RPC 는 못 쓴다", () => {
    expect(() => asUser(STUDENT_ID, `select count(usage_scope) from problems;`)).not.toThrow();
    expect(fails(() => asUser(STUDENT_ID, `select similarity_group_manual from problems limit 1;`))).toContain("permission denied");
    expect(fails(() => asUser(STUDENT_ID, `select correct_index from problems limit 1;`))).toContain("permission denied");
    expect(fails(() => asUser(STUDENT_ID, `select count(*) from problem_usage_scope_changes;`))).toContain("permission denied");
    expect(fails(() => asUser(STUDENT_ID, `select retag_problem_usage_scope(array[]::uuid[], 'general', null);`))).toContain("permission denied");
    expect(fails(() => asUser(STUDENT_ID, `select create_bank_problem('${SUBJECT_ID}', 'mc', '', '', 'medium', null, null, null, null, 'general');`))).toContain("permission denied");
  });
});

describe("모의고사 조립 게이트 — 일반용은 세트 문항이 될 수 없다", () => {
  it("세트 문항 INSERT: general 거절, mock_exam·both 허용. 나중에 재분류해도 이미 담긴 문항은 그대로", () => {
    const setId = psql(`insert into mock_exam_sets (name, difficulty_tier, status) values ('용도 게이트 ${RUN}', 'standard', 'draft') returning id;`);
    createdSets.push(setId);
    const add = (problemId: string, pos: number) => {
      const v = psql(`select published_version_id from problems where id = '${problemId}';`);
      return psql(
        `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', 'rw', ${pos}, '${problemId}', '${v}', 'rw_craft_structure', 'medium') returning id;`,
      );
    };
    expect(fails(() => add(poolGeneral[0], 1))).toContain("일반용 문제는 모의고사에 넣을 수 없습니다");
    add(poolMock[0], 2);
    add(poolBoth[0], 3);
    // 이미 담긴 뒤 general 로 바꿔도 세트는 그대로(과거 고정 불변).
    psql(`update problems set usage_scope = 'general' where id = '${poolMock[0]}';`);
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${setId}';`)).toBe("2");
    psql(`update problems set usage_scope = 'mock_exam' where id = '${poolMock[0]}';`);
  });
});

describe("수업·과제 후보 게이트 — 모의고사용은 어느 경로로도 후보가 아니다", () => {
  it("자동 구성 후보 뷰: general·both 만", () => {
    const ids = psql(`select problem_id from problem_auto_composition_candidates where keyword_id = '${keywordId}';`).split("\n").filter(Boolean);
    expect(ids.sort()).toEqual([...poolGeneral, ...poolBoth].sort());
    for (const m of poolMock) expect(ids).not.toContain(m);
  });

  it("issue_homework_batch(키워드 직접 발급): 모의고사용은 뽑히지 않는다", () => {
    const sessionId = newSession("usage-scope-a");
    const issued = Number(asUser(TEACHER_ID, `select issue_homework_batch('${STUDENT_ID}', '${sessionId}', '[{"keyword_id":"${keywordId}","count":20}]'::jsonb);`));
    expect(issued).toBe(poolGeneral.length + poolBoth.length);
    const items = psql(`select problem_id from session_homework_items where session_id = '${sessionId}';`).split("\n").filter(Boolean);
    for (const m of poolMock) expect(items).not.toContain(m);
  });

  it("compose_homework_from_session(회차 키워드 자동 구성): 모의고사용은 뽑히지 않는다", () => {
    const sessionId = newSession("usage-scope-b");
    const out = asUser(TEACHER_ID, `select issued_count from compose_homework_from_session('${sessionId}', array['${keywordId}']::uuid[], 20, true, true);`);
    expect(Number(out.split("\n")[0])).toBe(poolGeneral.length + poolBoth.length);
    const items = psql(`select problem_id from session_homework_items where session_id = '${sessionId}';`).split("\n").filter(Boolean);
    for (const m of poolMock) expect(items).not.toContain(m);
  });

  it("issue_homework_items(교사가 골라 발급): 모의고사용 거절, 일반용 허용", () => {
    const sessionId = newSession("usage-scope-c");
    psql(`insert into session_curriculum_units (session_id, overlay_unit_id, role) values ('${sessionId}', '${overlayUnitId}', 'primary');`);
    expect(fails(() => asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${poolMock[0]}']::uuid[]);`))).toContain("모의고사용");
    expect(asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${poolGeneral[0]}']::uuid[]);`)).toBe("1");
  });

  it("과제 항목 트리거(직접 INSERT 우회 차단)", () => {
    const sessionId = newSession("usage-scope-d");
    const insert = (pid: string) =>
      psql(
        `insert into session_homework_items (session_id, problem_id, student_id, position, was_used_in_lesson, was_already_attempted, composed_by, problem_version_id)
         values ('${sessionId}', '${pid}', '${STUDENT_ID}', 1, false, false, '${TEACHER_ID}', (select published_version_id from problems where id = '${pid}'));`,
      );
    expect(fails(() => insert(poolMock[1]))).toContain("모의고사용 문제는 과제로 발급할 수 없습니다");
    expect(() => insert(poolBoth[1])).not.toThrow();
  });

  it("관리자 기준본 회차: 수동 담기 거절 + 자동 구성은 일반용·기존만, 재분류하면 다음 동기화에서 빠진다", () => {
    const unitId = psql(`insert into subject_template_units (subject_id, position, unit_title) values ('${SUBJECT_ID}', ${900000 + (Date.now() % 90000)}, '용도 ${RUN}') returning id;`);
    createdUnits.push(unitId);
    expect(fails(() => psql(`insert into subject_template_unit_problems (unit_id, problem_id, position) values ('${unitId}', '${poolMock[0]}', 1);`))).toContain("모의고사용");
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${keywordId}');`);
    psql(`select * from sync_catalog_unit_auto_problems('${unitId}');`);
    const composed = () => psql(`select problem_id from subject_template_unit_problems where unit_id = '${unitId}';`).split("\n").filter(Boolean).sort();
    expect(composed()).toEqual([...poolGeneral, ...poolBoth].sort());
    // 일반용 하나를 모의고사용으로 옮기면 다음 동기화에서 회차 후보에서 빠진다(이미 고정된 세션은 별개 — 매니페스트는 손대지 않는다).
    psql(`update problems set usage_scope = 'mock_exam' where id = '${poolGeneral[2]}';`);
    psql(`select * from sync_catalog_unit_auto_problems('${unitId}');`);
    expect(composed()).not.toContain(poolGeneral[2]);
    psql(`update problems set usage_scope = 'general' where id = '${poolGeneral[2]}';`);
  });

  it("수업 준비안(prep) 항목: 모의고사용 거절", () => {
    const prepId = psql(`insert into curriculum_unit_preps (overlay_unit_id) values ('${overlayUnitId}') on conflict do nothing returning id;`) ||
      psql(`select id from curriculum_unit_preps where overlay_unit_id = '${overlayUnitId}';`);
    expect(fails(() => psql(`insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${poolMock[2]}', 1);`))).toContain("모의고사용");
    expect(() => psql(`insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${poolBoth[0]}', 1);`)).not.toThrow();
  });
});

describe("유사문항 그룹 자동 부여", () => {
  it("결정적: 같은 입력은 같은 키, 숫자·문장부호·대소문자만 다른 문항은 같은 그룹, 다른 틀·다른 skill 은 다른 그룹", () => {
    const key = (skill: string, via: string, sub: string | null, passage: string | null, question: string | null = null) =>
      psql(`select problem_similarity_key(${q(skill)}, ${q(via)}, ${sub ? q(sub) : "null"}, ${passage ? q(passage) : "null"}, ${question ? q(question) : "null"});`);
    const a1 = key("algebra_x", "manual", null, "If 3x + 5 = 20, what is the value of x?");
    expect(key("algebra_x", "manual", null, "If 3x + 5 = 20, what is the value of x?")).toBe(a1);
    expect(key("algebra_x", "manual", null, "if 4X+17 = 231 , WHAT is the value of x")).toBe(a1); // 숫자·부호·대소문자
    expect(key("algebra_x", "manual", null, "A train travels 120 miles in 3 hours. What is its speed?")).not.toBe(a1); // 다른 틀
    expect(key("other_skill", "manual", null, "If 3x + 5 = 20, what is the value of x?")).not.toBe(a1); // 다른 skill
    expect(a1).toMatch(/^t:algebra_x:[0-9a-f]{16}$/);
    expect(key("algebra_x", "manual", null, null)).toBe("");
    // 컴파일러: (skill, subpattern) — 본문이 달라도 같은 세부 패턴이면 같은 그룹
    expect(key("circles", "compiler", "arc_length", "본문 하나")).toBe("c:circles:arc_length");
    expect(key("circles", "compiler", "arc_length", "전혀 다른 본문 8")).toBe("c:circles:arc_length");
    expect(key("circles", "compiler", "sector_area", "본문 하나")).toBe("c:circles:sector_area");
    // 컴파일러여도 subpattern 이 없으면 본문 지문으로
    expect(key("circles", "compiler", null, "본문 하나")).toMatch(/^t:circles:/);
  });

  it("문제 생성 → 초안 저장으로 본문이 생기면 자동 부여되고, 구조가 같은 문항은 같은 그룹", () => {
    const p1 = bank("mock_exam");
    expect(group(p1)).toBe("<null>"); // 본문 전
    draft(p1, `Usage ${RUN} If 3x + 5 = 20, what is the value of x?`);
    const p2 = bank("mock_exam");
    draft(p2, `usage ${RUN} if 9x+2 = 77, WHAT is the value of x`);
    const p3 = bank("mock_exam");
    draft(p3, `Usage ${RUN} A rectangle has a length of 4 and a width of 9. What is its area?`);
    expect(group(p1)).toMatch(/^t:words_in_context:/);
    expect(group(p2)).toBe(group(p1));
    expect(group(p3)).not.toBe(group(p1));
    // 초안을 고치면 따라간다
    draft(p2, `Usage ${RUN} completely different stem about a pond ecosystem.`);
    expect(group(p2)).not.toBe(group(p1));
  });

  it("컴파일러 문제: created_via 와 subpattern 이 기록되면 (skill, subpattern) 키가 된다", () => {
    const c1 = bank("mock_exam");
    const c2 = bank("mock_exam");
    const c3 = bank("mock_exam");
    for (const [id, sub] of [[c1, "arc_length"], [c2, "arc_length"], [c3, "sector_area"]] as const) {
      psql(`update problems set created_via = 'compiler' where id = '${id}';`);
      psql(`update problems set subpattern = '${sub}' where id = '${id}';`);
    }
    expect(group(c1)).toBe("c:words_in_context:arc_length");
    expect(group(c2)).toBe(group(c1));
    expect(group(c3)).toBe("c:words_in_context:sector_area");
  });

  it("수동 지정은 잠기고(자동 계산이 덮지 않음), 잠금을 풀면 자동 값으로 돌아간다. 만들 때 넣은 그룹도 수동", () => {
    const p = bank("mock_exam");
    draft(p, `Usage ${RUN} manual lock stem alpha`);
    const auto = group(p);
    psql(`update problems set similarity_group = 'custom-${RUN}', similarity_group_manual = true where id = '${p}';`);
    draft(p, `Usage ${RUN} manual lock stem beta`); // 본문이 바뀌어도
    psql(`update problems set skill_code = 'transitions' where id = '${p}';`); // skill 이 바뀌어도
    expect(group(p)).toBe(`custom-${RUN}`);
    psql(`update problems set similarity_group_manual = false where id = '${p}';`);
    expect(group(p)).toMatch(/^t:transitions:/);
    expect(group(p)).not.toBe(auto);
    const inserted = psql(`insert into problems (format, subject_id, status, created_by, similarity_group) values ('mc', '${SUBJECT_ID}', 'draft', '${ADMIN_ID}', 'explicit-${RUN}') returning id;`);
    createdProblems.push(inserted);
    expect(psql(`select similarity_group || '|' || similarity_group_manual from problems where id = '${inserted}';`)).toBe(`explicit-${RUN}|true`);
  });

  it("백필은 멱등이고 수동 값을 덮지 않는다", () => {
    const sql = readFileSync(path.join(__dirname, "../supabase/migrations/20261907000000_problem_usage_scope.sql"), "utf-8");
    const start = sql.indexOf("update public.problems p\n   set similarity_group = k.key");
    const end = sql.indexOf(";", start) + 1;
    expect(start).toBeGreaterThan(0);
    const backfill = sql.slice(start, end);

    const auto = bank("mock_exam");
    draft(auto, `Usage ${RUN} backfill stem one`);
    const expected = group(auto);
    const manual = bank("mock_exam");
    draft(manual, `Usage ${RUN} backfill stem two`);
    psql(`update problems set similarity_group = 'keep-${RUN}', similarity_group_manual = true where id = '${manual}';`);
    // 자동 계산값을 망가뜨려 놓고(직접 컬럼 UPDATE 는 트리거를 타지 않는다) 백필로 복원되는지 본다.
    psql(`update problems set similarity_group = 'stale' where id = '${auto}';`);

    psql(backfill);
    expect(group(auto)).toBe(expected);
    expect(group(manual)).toBe(`keep-${RUN}`);
    const again = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", backfill], { encoding: "utf-8" });
    expect(again).toContain("UPDATE 0");
  });
});
