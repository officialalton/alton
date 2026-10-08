import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// AP 후보 → 문제은행(검수 환경) 변환 + AP 모의고사 세트/응시 DB 계약(마이그레이션 20262100000400·401).
// psql + set role 패턴. 실행 ID(RUN) 접두 행만 만들고 afterAll 에서 지운다(공식 데이터·SAT 세트는 건드리지 않음). 로컬 DB 전용.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `apx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const AP_CODE = `ap_t_${RUN}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}
function fails(fn: () => unknown): string {
  try { fn(); } catch (e) { return String((e as { stderr?: string }).stderr ?? e); }
  return "";
}
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

let subjectId: string;
let freeA: string, freeB: string, tutoring: string;
const K = (n: string) => `${RUN}-${n}`;

function mcPayload(stem: string) {
  return { stem, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } };
}
function addCandidate(name: string, o: { kind?: "mc" | "frq_bundle"; state?: string; render?: boolean; screen?: boolean; current?: boolean; payload?: unknown } = {}) {
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, is_current)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, ${q(o.kind ?? "mc")}, '1.1', '1.A', ${q(o.kind === "frq_bundle" ? "frq_multipart" : "standalone")}, 'select', 'exact',
        ${json(o.payload ?? mcPayload(`Stem ${name}`))}, ${q(o.state ?? "auto_passed")}, ${o.render ?? true}, ${o.screen ?? true}, ${o.current ?? true});`);
}
/** 변환 체인(기존 문제은행 공개 경로) — 실행기(lib/ap-exam/convert-run.ts)와 같은 RPC 순서. */
function convert(name: string, purpose: "mock_exam" | "lesson", opts: { frq?: boolean } = {}): string {
  const fmt = opts.frq ? "essay" : "mc";
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, ${q(purpose)}, ${q(fmt)}, '${ADMIN_ID}', 'medium', '1.1');`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${opts.frq ? "null" : json(["A1", "B2", "C3", "D4"])}, p_correct_index => ${opts.frq ? "null" : 1},
      p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_statements => ${opts.frq ? json([{ label: "a", points: 2, prompt: "Explain the result.", mode: "explain" }, { label: "b", points: 1, prompt: "Calculate the rate.", mode: "calculate" }]) : "null"},
      p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}', 14);`);
  return pid;
}
function createStudent(label: string, memberType: "free" | "tutoring"): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', '${memberType}', '${memberType === "free" ? "self_signup" : "admin_direct"}', '10th', now());`);
  return id;
}
const LAYOUT_FULL = { sections: [
  { key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 2, calculator: "allowed", options: 4 },
  { key: "ap_frq", kind: "frq", label: "Section II", minutes: 20, count: 1, calculator: "allowed" },
] };
function createApSet(label: string, apLabel: string, tier: "free" | "tutoring", layout = LAYOUT_FULL, status = "draft"): string {
  void tier; void status; // 무료 공개(access_tier=free)는 공개와 같은 UPDATE 에서만 지정할 수 있다 → publishSet
  return psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, access_tier, exam_program, ap_subject, ap_label, section_layout)
    values (${q(`${RUN}-${label}`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'tutoring', 'ap', ${q(AP_CODE)}, ${q(apLabel)}, ${json(layout)}) returning id;`);
}
function publishSet(id: string, tier: "free" | "tutoring") {
  psql(`update mock_exam_sets set status = 'published', published_at = now(), access_tier = ${q(tier)} where id = '${id}';`);
}
function addItem(setId: string, pid: string, section: string, pos: number) {
  const vid = psql(`select published_version_id from problems where id = '${pid}'`);
  psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', ${q(section)}, ${pos}, '${pid}', '${vid}', 'ap:1.1', 'medium');`);
}

let mock1: string, mock2: string, lesson1: string, frq1: string;

beforeAll(() => {
  subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP Test`)}, ${q(AP_CODE)}) returning id;`);
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) values ('${subjectId}', ${q(`${RUN} kw`)}, ${q(`${RUN} kw`)}, '1.1', 1);`);
  freeA = createStudent("freeA", "free");
  freeB = createStudent("freeB", "free");
  tutoring = createStudent("tutoring", "tutoring");
  addCandidate("mock1"); addCandidate("mock2"); addCandidate("lesson1"); addCandidate("frq1", { kind: "frq_bundle", payload: { title: "FRQ", parts: [], stimulus: { kind: "none" } } });
  addCandidate("unverified", { render: false, screen: false });
  addCandidate("noscreen", { render: true, screen: false });
  addCandidate("stale", { state: "needs_revalidation" });
  addCandidate("old", { current: false });
  addCandidate("late"); // 변환 중 게이트에서 탈락시키는 용도
  mock1 = convert("mock1", "mock_exam");
  mock2 = convert("mock2", "mock_exam");
  lesson1 = convert("lesson1", "lesson");
  frq1 = convert("frq1", "mock_exam", { frq: true });
});

afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from ap_candidate_problems where candidate_key like '${RUN}-%';
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problem_error_reports where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problem_versions where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problems where ap_candidate_key like '${RUN}-%';
    delete from ap_stock_purpose_targets where subject_id = '${subjectId}';
    delete from ap_candidate_items where candidate_key like '${RUN}-%';
    delete from subject_keywords where subject_id = '${subjectId}';
    delete from subjects where id = '${subjectId}';
    delete from students where id in (select id from profiles where name like '${RUN}-%');
    delete from profiles where name like '${RUN}-%';
    delete from auth.users where email like '${RUN}-%';
    commit;`);
});

describe("변환 게이트: 검증 안 된 후보는 문제은행에 들어갈 수 없다", () => {
  it("렌더·화면 검증이 없거나 재검증 필요·이전 배치 후보는 변환 불가", () => {
    for (const n of ["unverified", "noscreen", "stale", "old"]) {
      expect(fails(() => psql(`select ap_create_bank_problem(${q(K(n))}, 0, 'mock_exam', 'mc', '${ADMIN_ID}');`))).toMatch(/not review-env ready/);
    }
  });
  it("create_bank_problem 우회·키 없는 직접 INSERT 도 막힌다", () => {
    expect(fails(() => psql(`select create_bank_problem('${subjectId}', 'mc', null, null, 'medium', '${ADMIN_ID}', null, 'ap', ${q(AP_CODE)}, 'mock_exam');`))).toMatch(/review-ready AP candidate/);
    expect(fails(() => psql(`insert into problems (format, subject_id, status, exam_system, ap_subject, usage_scope, ap_candidate_key) values ('mc', '${subjectId}', 'draft', 'ap', ${q(AP_CODE)}, 'mock_exam', ${q(K("unverified"))});`))).toMatch(/not review-env ready/);
  });
  it("변환 뒤 상태: review_env, 용도 고정, 검수 기간, 기존 공개 게이트 통과", () => {
    expect(psql(`select release_tier || '|' || purpose || '|' || (review_period_ends_at is not null) from ap_candidate_items where candidate_key = ${q(K("mock1"))};`)).toBe("review_env|mock_exam|true");
    expect(psql(`select usage_scope || '|' || exam_system || '|' || status from problems where id = '${mock1}';`)).toBe("mock_exam|ap|confirmed");
    expect(psql(`select usage_scope from problems where id = '${lesson1}';`)).toBe("general");
  });
  it("finalize 는 멱등이고 용도는 바뀌지 않는다(공유·변경 불가)", () => {
    psql(`select ap_finalize_conversion(${q(K("mock1"))}, '${ADMIN_ID}', 14);`);
    expect(psql(`select count(*) from ap_candidate_problems where candidate_key = ${q(K("mock1"))};`)).toBe("1");
    expect(fails(() => psql(`update ap_candidate_items set purpose = 'lesson' where candidate_key = ${q(K("mock1"))};`))).toMatch(/fixed at conversion/);
    expect(fails(() => psql(`update problems set usage_scope = 'general' where id = '${mock1}';`))).toMatch(/fixed at conversion/);
    expect(fails(() => psql(`select ap_create_bank_problem(${q(K("mock1"))}, 1, 'lesson', 'mc', '${ADMIN_ID}');`))).toMatch(/already fixed/);
  });
  it("재고 상태가 바뀐 후보는 공개 단계에서도 막힌다", () => {
    const pid = psql(`select ap_create_bank_problem(${q(K("late"))}, 0, 'mock_exam', 'mc', '${ADMIN_ID}', 'medium');`);
    const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${json(["A1", "B2"])}, p_correct_index => 1, p_explanation => 'x', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_question => 'q?', p_explanation_en => 'English explanation text.');`);
    psql(`select set_problem_render_check('${vid}', ${json({ ok: true, issues: [] })});`);
    psql(`update ap_candidate_items set render_verified = false where candidate_key = ${q(K("late"))};`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`))).toMatch(/no longer review-env ready/);
    psql(`update ap_candidate_items set render_verified = true where candidate_key = ${q(K("late"))};`);
  });
  it("검증 기록 RPC 는 자동 게이트 통과 후보만, 변환 뒤엔 바꿀 수 없다", () => {
    expect(fails(() => psql(`select ap_set_verification(${q(K("stale"))}, true, true, '{}'::jsonb, '${ADMIN_ID}');`))).toMatch(/passed the latest automatic gate/);
    expect(fails(() => psql(`select ap_set_verification(${q(K("mock1"))}, false, false, '{}'::jsonb, '${ADMIN_ID}');`))).toMatch(/cannot be changed/);
  });
});

describe("용도 분리: 수업용(lesson) 풀과 모의고사 풀", () => {
  it("수업용 문항은 모의 세트에 들어갈 수 없다(AP·SAT 세트 모두)", () => {
    const set = createApSet("lesson-reject", "mc_practice", "free");
    const vid = psql(`select published_version_id from problems where id = '${lesson1}'`);
    expect(fails(() => psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${set}', 'ap_mc', 1, '${lesson1}', '${vid}', 'ap:1.1', 'medium');`))).toMatch(/Lesson-purpose|일반용 문제는 모의고사에 넣을 수 없습니다/);
    const sat = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status) values (${q(`${RUN}-sat-reject`)}, 'standard', 'draft', 'fixed', 'not_applicable') returning id;`);
    const mv = psql(`select published_version_id from problems where id = '${mock1}'`);
    expect(fails(() => psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${sat}', 'rw', 1, '${mock1}', '${mv}', 'rw_x', 'medium');`))).toMatch(/cannot be added to an SAT exam set/);
  });
  it("교사 문제 선택 후보 뷰: 수업용만 보이고 모의고사용은 보이지 않는다", () => {
    expect(psql(`select count(*) from problem_auto_composition_candidates where problem_id = '${lesson1}';`)).toBe("1");
    expect(psql(`select count(*) from problem_auto_composition_candidates where problem_id in ('${mock1}','${mock2}','${frq1}');`)).toBe("0");
  });
  it("용도 값 매핑: 수업용 = 수업·과제 용도, 모의용 = 모의고사 용도", () => {
    // 기존 게이트(check_unit_problem_usable): 모의고사용 문제는 회차 구성에 담을 수 없다.
    expect(psql(`select usage_scope from problems where id = '${lesson1}';`)).toBe("general");
    expect(psql(`select usage_scope from problems where id = '${mock1}';`)).toBe("mock_exam");
  });
  it("용도별 재고·부족분 뷰", () => {
    psql(`insert into ap_stock_purpose_targets (subject_id, kind, purpose, target) values ('${subjectId}', 'mc', 'mock_exam', 5), ('${subjectId}', 'mc', 'lesson', 3);`);
    const rows = psql(`select purpose || ':' || target || ':' || converted || ':' || shortfall from ap_stock_by_purpose_v where subject = ${q(AP_CODE)} and kind = 'mc' order by purpose;`).split("\n");
    expect(rows).toEqual(["lesson:3:1:2", "mock_exam:5:2:3"]);
    const pool = psql(`select purpose_shortfall_total || ':' || net_shortfall from ap_stock_pool_v where subject = ${q(AP_CODE)} and kind = 'mc';`);
    expect(pool.split(":")[0]).toBe("5");
  });
});

describe("AP 세트 조립·공개", () => {
  it("같은 과목·모의 용도·허용 섹션만, 라벨 구조가 맞아야 공개된다", () => {
    const set = createApSet("assemble", "full_practice", "free");
    addItem(set, mock1, "ap_mc", 1);
    expect(fails(() => addItem(set, mock2, "ap_bogus", 2))).toMatch(/not part of this exam layout/);
    expect(fails(() => publishSet(set, "free"))).toMatch(/does not match its AP label/);
    addItem(set, mock2, "ap_mc", 2);
    addItem(set, frq1, "ap_frq", 1);
    publishSet(set, "free");
    expect(psql(`select status || '|' || access_tier from mock_exam_sets where id = '${set}';`)).toBe("published|free");
  });
  it("라벨 규칙: MC 만 있는 세트는 mc_practice 로만 공개되고 FRQ 가 섞이면 거부된다", () => {
    const set = createApSet("mcl", "mc_practice", "free");
    addItem(set, mock1, "ap_mc", 1); addItem(set, mock2, "ap_mc", 2);
    addItem(set, frq1, "ap_frq", 1);
    expect(fails(() => publishSet(set, "free"))).toMatch(/outside the mc_practice label/);
  });
  it("SAT 세트 형태 제약: AP 필드를 SAT 세트에 넣을 수 없다", () => {
    expect(fails(() => psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, ap_subject) values (${q(`${RUN}-badsat`)}, 'standard', 'draft', 'fixed', 'not_applicable', 'x');`))).toMatch(/mock_exam_sets_ap_shape_check/);
    expect(fails(() => psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
      select s.id, 'foo', 1, '${mock1}', published_version_id, 'x', 'medium' from mock_exam_sets s, problems where s.name = ${q(`${RUN}-assemble`)} and problems.id = '${mock1}';`))).toMatch(/section_check|violates check|not part of this exam layout/);
  });
});

describe("학생 응시 흐름(무료 회원)", () => {
  let setId: string, tutorSet: string, attemptA: string;
  beforeAll(() => {
    setId = psql(`select id from mock_exam_sets where name = ${q(`${RUN}-assemble`)};`);
    tutorSet = createApSet("tutoring-only", "frq_practice", "tutoring", { sections: [{ key: "ap_frq", kind: "frq", label: "S2", minutes: 20, count: 1, calculator: "allowed" }] });
    addItem(tutorSet, frq1, "ap_frq", 1);
    publishSet(tutorSet, "tutoring");
  });
  it("카탈로그: 무료 회원은 무료 AP 세트만, AP 필드 포함 / 과외 전용 세트는 숨김", () => {
    const ids = asUser(freeA, `select coalesce(string_agg(x->>'examSetId', ',' order by x->>'name'), '') from jsonb_array_elements(mock_exam_open_catalog('${freeA}')) x where x->>'name' like '${RUN}-%';`);
    expect(ids.split(",")).toContain(setId);
    expect(ids).not.toContain(tutorSet);
    const row = asUser(freeA, `select x->>'examProgram' || '|' || (x->>'apLabel') || '|' || (x->>'apSubject') from jsonb_array_elements(mock_exam_open_catalog('${freeA}')) x where x->>'examSetId' = '${setId}';`);
    expect(row).toBe(`ap|full_practice|${AP_CODE}`);
    expect(asUser(tutoring, `select count(*) from jsonb_array_elements(mock_exam_open_catalog('${tutoring}')) x where x->>'examSetId' = '${tutorSet}';`)).toBe("1");
    expect(fails(() => asUser(freeA, `select mock_exam_open_start('${tutorSet}');`))).toMatch(/tutoring members only/);
  });
  it("시작 → 문항 상세: 선택지 수·섹션 레이아웃, 정답·해설 비노출", () => {
    attemptA = asUser(freeA, `select mock_exam_open_start('${setId}');`);
    const d = JSON.parse(asUser(freeA, `select mock_exam_attempt_detail('${attemptA}');`)) as { examProgram: string; apLabel: string; sectionLayout: { key: string }[]; items: { section: string; format: string; optionCount: number | null; correctIndex: number | null; explanation: string | null; answers: unknown; parts: unknown }[] };
    expect(d.examProgram).toBe("ap");
    expect(d.apLabel).toBe("full_practice");
    expect(d.sectionLayout.map((s) => s.key)).toEqual(["ap_mc", "ap_frq"]);
    expect(d.items).toHaveLength(3);
    const mc = d.items.filter((i) => i.section === "ap_mc");
    expect(mc.every((i) => i.optionCount === 4 && i.correctIndex === null && i.explanation === null)).toBe(true);
    const frq = d.items.find((i) => i.section === "ap_frq")!;
    expect(frq.format).toBe("essay");
    expect(frq.explanation).toBeNull();
    expect(JSON.stringify(frq.parts)).toContain("Explain the result.");
  });
  it("학생이 문제·버전·세트 항목 원본을 직접 읽을 수 없다(수업용 포함)", () => {
    for (const t of ["problems", "problem_versions", "mock_exam_set_items"]) {
      const where = t === "problem_versions" ? `problem_id in ('${mock1}','${lesson1}','${frq1}')` : t === "problems" ? `id in ('${mock1}','${lesson1}','${frq1}')` : `exam_set_id = '${setId}'`;
      expect(asUser(freeA, `select count(*) from ${t} where ${where};`)).toBe("0");
    }
  });
  it("답 저장·FRQ 자동 저장·시간 저장, 타 사용자 격리", () => {
    const items = JSON.parse(asUser(freeA, `select mock_exam_attempt_detail('${attemptA}');`)).items as { setItemId: string; section: string }[];
    const mcItem = items.find((i) => i.section === "ap_mc")!, frqItem = items.find((i) => i.section === "ap_frq")!;
    asUser(freeA, `select mock_exam_save_answer('${attemptA}', '${mcItem.setItemId}', '1', 12);`);
    asUser(freeA, `select mock_exam_save_answer('${attemptA}', '${frqItem.setItemId}', ${q(JSON.stringify({ a: "My partial answer", b: "" }))}, 40);`);
    asUser(freeA, `select mock_exam_save_answer('${attemptA}', '${frqItem.setItemId}', ${q(JSON.stringify({ a: "My longer answer", b: "42" }))}, 55);`);
    asUser(freeA, `select mock_exam_save_section_time('${attemptA}', 'ap_mc', 1200);`);
    expect(fails(() => asUser(freeA, `select mock_exam_save_section_time('${attemptA}', 'bogus', 1);`))).toMatch(/Invalid section/);
    const saved = JSON.parse(asUser(freeA, `select mock_exam_attempt_detail('${attemptA}');`)).items.find((i: { section: string }) => i.section === "ap_frq");
    expect(JSON.parse(saved.response)).toEqual({ a: "My longer answer", b: "42" });
    expect(fails(() => asUser(freeB, `select mock_exam_attempt_detail('${attemptA}');`))).toMatch(/permission/);
    expect(fails(() => asUser(freeB, `select mock_exam_save_answer('${attemptA}', '${mcItem.setItemId}', '2');`))).toMatch(/own attempt|own exam|본인/);
  });
  it("제출 후: MC 자동 채점, 정답·해설 공개, FRQ 는 정오 없이 참고 해설(비공식)", () => {
    asUser(freeA, `select mock_exam_submit('${attemptA}');`);
    const d = JSON.parse(asUser(freeA, `select mock_exam_attempt_detail('${attemptA}');`)) as { status: string; items: { section: string; correctIndex: number | null; correct: boolean | null; explanation: string | null; response: string | null }[] };
    expect(d.status).toBe("graded");
    const mc = d.items.filter((i) => i.section === "ap_mc");
    expect(mc.every((i) => i.correctIndex === 1 && i.explanation)).toBe(true);
    expect(mc.filter((i) => i.response === "1").every((i) => i.correct === true)).toBe(true);
    const frq = d.items.find((i) => i.section === "ap_frq")!;
    expect(frq.correct).toBeNull();
    expect(frq.explanation).toContain("Because B2");
    expect(JSON.parse(frq.response!)).toEqual({ a: "My longer answer", b: "42" });
    const sum = JSON.parse(asUser(freeA, `select mock_exam_attempt_summaries('${freeA}');`)) as { examProgram: string; correctCount: number }[];
    expect(sum[0].examProgram).toBe("ap");
  });
  it("재응시: 채점 뒤 다시 시작하면 새 회차(attempt_no 2), 진행 중이면 이어하기(멱등)", () => {
    const again = asUser(freeA, `select mock_exam_open_start('${setId}');`);
    expect(again).not.toBe(attemptA);
    expect(asUser(freeA, `select mock_exam_open_start('${setId}');`)).toBe(again);
    expect(psql(`select attempt_no from mock_exam_attempts where id = '${again}';`)).toBe("2");
  });
  it("SAT 응시 흐름 회귀: SAT 세트는 examProgram=sat 로 나오고 AP 필드가 없다", () => {
    const sat = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at, access_tier) values (${q(`${RUN}-sat-ok`)}, 'standard', 'published', 'fixed', 'not_applicable', now(), 'free') returning id;`);
    const r = asUser(freeB, `select x->>'examProgram' || '|' || coalesce(x->>'apSubject','null') from jsonb_array_elements(mock_exam_open_catalog('${freeB}')) x where x->>'examSetId' = '${sat}';`);
    expect(r).toBe("sat|null");
  });
});
