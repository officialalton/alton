import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { dockerPsSnapshot, verifySameIsolatedStack } from "@/lib/dev/stack-identity";

// 로컬 supabase 의 공개 데모 service_role 키(격리 스택 전용 — 다른 통합 테스트와 같은 값). 원격 키가 아니다.
const LOCAL_DEMO_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ supabase: h.client, adminUserId: "aaaaaaaa-0000-0000-0000-000000000001" }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => h.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// 모의고사 새 버전 적용(마이그레이션 20262100000480~483, docs/ap/set-new-version-design.md).
// 격리 스택 전용: SUPABASE_TEST_DB_URL·SUPABASE_TEST_API_URL 을 명시해야 하고, 둘이 같은 격리 project(ALTON_<이름>)인지 docker 로 확인한다(공유 ALTON 이면 실패).
// 실행 ID(RUN) 접두 행만 만든다. 정리는 격리 스택 teardown 이 한다(이 테스트는 삭제하지 않는다).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "";
const API_URL = process.env.SUPABASE_TEST_API_URL ?? "";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `nv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const AP_CODE = `ap_t_${RUN}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
const asUser = (userId: string, sql: string) =>
  psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
function fails(fn: () => unknown): string {
  try { fn(); } catch (e) { return String((e as { stderr?: string }).stderr ?? e); }
  return "";
}
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const K = (n: string) => `${RUN}-${n}`;

let subjectId: string;
const P: Record<string, string> = {}; // 후보 이름 → problem id

function addCandidate(name: string, o: { kind?: "mc" | "frq_bundle"; calc?: string } = {}) {
  const payload = o.kind === "frq_bundle"
    ? { title: "FRQ", parts: [], stimulus: { kind: "none" } }
    : { stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } };
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, is_current, calculator)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, ${q(o.kind ?? "mc")}, '1.1', '1.A', ${q(o.kind === "frq_bundle" ? "frq_multipart" : "standalone")}, 'select', 'exact', ${json(payload)}, 'auto_passed', true, true, true, ${q(o.calc ?? "na")});`);
}
function convert(name: string, purpose: "mock_exam" | "lesson", frq = false): string {
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, ${q(purpose)}, ${q(frq ? "essay" : "mc")}, '${ADMIN_ID}', 'medium', '1.1');`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${frq ? "null" : json(["A1", "B2", "C3", "D4"])}, p_correct_index => ${frq ? "null" : 1},
      p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_statements => ${frq ? json([{ label: "a", points: 2, prompt: "Explain the result.", mode: "explain" }, { label: "b", points: 1, prompt: "Calculate the rate.", mode: "calculate" }]) : "null"},
      p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  return pid;
}
function createStudent(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', 'free', 'self_signup', '10th', now());`);
  return id;
}
const LAYOUT = { sections: [
  { key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 3, calculator: "allowed", options: 4 },
  { key: "ap_frq", kind: "frq", label: "Section II", minutes: 20, count: 1, calculator: "allowed" },
] };
const addItem = (setId: string, pid: string, section: string, pos: number) => {
  const vid = psql(`select published_version_id from problems where id = '${pid}'`);
  psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', ${q(section)}, ${pos}, '${pid}', '${vid}', 'ap:1.1', 'medium');`);
};
const createVersion = (src: string, swaps: unknown[], actor = ADMIN_ID) => JSON.parse(psql(`select mock_exam_create_new_version('${src}', ${json(swaps)}, '${actor}');`)) as { newSetId: string; versionNo: number; setGroupId: string; swapped: number };
const publishSet = (id: string) => JSON.parse(psql(`select mock_exam_publish_set('${id}', '${ADMIN_ID}');`)) as { publishedSetId: string; archivedSetIds: string[] };
const start = (student: string, setId: string) => asUser(student, `select mock_exam_open_start('${setId}');`);
const answer = (attempt: string, setId: string, section: string, pos: number, response: string | null) => {
  const item = psql(`select id from mock_exam_set_items where exam_set_id = '${setId}' and section = ${q(section)} and position = ${pos};`);
  psql(`insert into mock_exam_answers (attempt_id, set_item_id, response) values ('${attempt}', '${item}', ${response === null ? "null" : json(response)});`);
};
const grade = (attempt: string) => psql(`update mock_exam_attempts set status = 'graded', started_at = coalesce(started_at, now()), submitted_at = now(), graded_at = now(), attempt_count = 1 where id = '${attempt}';`);

let v1: string, v2: string, group: string;
let sA: string, sB: string, sC: string;
let attA1: string, attB1: string;

beforeAll(() => {
  if (!DB_URL || !API_URL) throw new Error("SUPABASE_TEST_DB_URL 과 SUPABASE_TEST_API_URL 을 격리 스택으로 명시해야 한다.");
  const r = verifySameIsolatedStack({ dbUrl: DB_URL, apiUrls: [API_URL], dockerPs: dockerPsSnapshot() });
  if (!r.ok) throw new Error(`격리 스택이 아니다: ${r.reasons.join(" ")}`);
  h.client = createClient(API_URL, LOCAL_DEMO_SERVICE_KEY); // 검증 통과(격리 스택) 뒤에만 만든다

  subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP Test`)}, ${q(AP_CODE)}) returning id;`);
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) values ('${subjectId}', ${q(`${RUN} kw`)}, ${q(`${RUN} kw`)}, '1.1', 1);`);
  for (const n of ["m1", "m2", "m3", "r1", "r2", "calc"]) addCandidate(n, { calc: n === "calc" ? "not_allowed" : "na" });
  addCandidate("f1", { kind: "frq_bundle" }); addCandidate("fr1", { kind: "frq_bundle" }); addCandidate("lesson1");
  for (const n of ["m1", "m2", "m3", "r1", "r2", "calc"]) P[n] = convert(n, "mock_exam");
  P.f1 = convert("f1", "mock_exam", true); P.fr1 = convert("fr1", "mock_exam", true); P.lesson1 = convert("lesson1", "lesson");

  v1 = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout)
    values (${q(`${RUN}-Full`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', ${q(AP_CODE)}, 'full_practice', ${json(LAYOUT)}) returning id;`);
  group = psql(`select set_group_id from mock_exam_sets where id = '${v1}';`);
  addItem(v1, P.m1, "ap_mc", 1); addItem(v1, P.m2, "ap_mc", 2); addItem(v1, P.m3, "ap_mc", 3); addItem(v1, P.f1, "ap_frq", 1);
  psql(`update mock_exam_sets set status = 'published', published_at = now(), access_tier = 'free' where id = '${v1}';`);

  sA = createStudent("A"); sB = createStudent("B"); sC = createStudent("C");
  // A: 1회차 완료(m1·m2 답, m3 공란, f1 답). B: 1회차 진행 중(m2 만 답).
  attA1 = start(sA, v1);
  answer(attA1, v1, "ap_mc", 1, "1"); answer(attA1, v1, "ap_mc", 2, "0"); answer(attA1, v1, "ap_mc", 3, null); answer(attA1, v1, "ap_frq", 1, "essay text");
  grade(attA1);
  attB1 = start(sB, v1);
  psql(`update mock_exam_attempts set status = 'in_progress', started_at = now() where id = '${attB1}';`);
  answer(attB1, v1, "ap_mc", 2, "2");
});

describe("새 버전 초안 생성(검증)", () => {
  it("슬롯 유형·용도·중복·계산기 규칙 위반은 거절되고 초안·문항 잔여물이 남지 않는다", () => {
    const versions = () => psql(`select count(*) from mock_exam_sets where set_group_id = '${group}';`);
    expect(versions()).toBe("1");
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.fr1 }]))).toMatch(/needs a mc problem|needs a mc item/);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.lesson1 }]))).toMatch(/not a mock-exam item|review_env_ready/);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.m2 }]))).toMatch(/already in this exam/);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 9, problem_id: P.r1 }]))).toMatch(/does not exist/);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.r1 }, { section: "ap_mc", position: 1, problem_id: P.r2 }]))).toMatch(/swapped twice/);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.m1 }]))).toMatch(/already holds/);
    expect(fails(() => createVersion(v1, []))).toMatch(/At least one/);
    // 계산기 규칙: 구간이 required 이면 not_allowed 문항은 거절.
    psql(`update mock_exam_sets set section_layout = jsonb_set(section_layout, '{sections,0,calculator}', '"required"') where id = '${v1}';`);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.calc }]))).toMatch(/calculator rule/);
    psql(`update mock_exam_sets set section_layout = jsonb_set(section_layout, '{sections,0,calculator}', '"allowed"') where id = '${v1}';`);
    expect(versions()).toBe("1"); // 실패한 시도는 전부 롤백
  });

  it("공개본 문항 스냅샷을 복사하고 교체 슬롯만 바꾼 version_no+1 초안을 같은 set_group_id 에 만든다(공개본은 그대로)", () => {
    const before = psql(`select status || '|' || version_no || '|' || (select count(*) from mock_exam_set_items where exam_set_id = '${v1}') from mock_exam_sets where id = '${v1}';`);
    const r = createVersion(v1, [{ section: "ap_mc", position: 2, problem_id: P.r1 }, { section: "ap_mc", position: 3, problem_id: P.r2 }]);
    v2 = r.newSetId;
    expect(r).toMatchObject({ versionNo: 2, setGroupId: group, swapped: 2 });
    expect(psql(`select status || '|' || version_no || '|' || exam_program || '|' || format || '|' || access_tier from mock_exam_sets where id = '${v2}';`)).toBe("draft|2|ap|ap_fixed|tutoring");
    expect(psql(`select string_agg(section || position || ':' || (select ap_candidate_key from problems where id = problem_id), ',' order by section, position) from mock_exam_set_items where exam_set_id = '${v2}';`))
      .toBe(`ap_frq1:${K("f1")},ap_mc1:${K("m1")},ap_mc2:${K("r1")},ap_mc3:${K("r2")}`);
    // 교체하지 않은 슬롯은 같은 문항 버전을 쓴다.
    expect(psql(`select count(*) from mock_exam_set_items a join mock_exam_set_items b on b.section = a.section and b.position = a.position and b.exam_set_id = '${v2}' where a.exam_set_id = '${v1}' and a.problem_version_id = b.problem_version_id;`)).toBe("2");
    // 공개본·응시는 그대로.
    expect(psql(`select status || '|' || version_no || '|' || (select count(*) from mock_exam_set_items where exam_set_id = '${v1}') from mock_exam_sets where id = '${v1}';`)).toBe(before);
    expect(psql(`select count(*) from mock_exam_attempts where exam_set_id = '${v2}';`)).toBe("0");
  });

  it("계열당 초안은 하나, 관리자만, 공개본에서만 만들 수 있다", () => {
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.r1 }]))).toMatch(/draft version already exists/);
    expect(fails(() => createVersion(v2, [{ section: "ap_mc", position: 1, problem_id: P.m3 }]))).toMatch(/currently published version/);
    expect(fails(() => createVersion(v1, [{ section: "ap_mc", position: 1, problem_id: P.r1 }], sA))).toMatch(/Only an admin/);
    expect(fails(() => asUser(sA, `select mock_exam_create_new_version('${v1}', ${json([{ section: "ap_mc", position: 1, problem_id: P.r1 }])}, '${ADMIN_ID}');`))).toMatch(/permission denied/);
  });
});

describe("새 버전 공개(원자적 교체)와 기존 응시 보존", () => {
  it("공개하면 이전 공개본이 한 트랜잭션으로 보관되고 새 버전이 공개 범위를 이어받는다", () => {
    const out = publishSet(v2);
    expect(out.publishedSetId).toBe(v2);
    expect(out.archivedSetIds).toEqual([v1]);
    expect(psql(`select string_agg(version_no || ':' || status, ',' order by version_no) from mock_exam_sets where set_group_id = '${group}' and status <> 'archived' or id = '${v1}';`)).toMatch(/1:archived/);
    expect(psql(`select count(*) from mock_exam_sets where set_group_id = '${group}' and status = 'published';`)).toBe("1");
    expect(psql(`select access_tier from mock_exam_sets where id = '${v2}';`)).toBe("free");
    expect(fails(() => publishSet(v2))).toMatch(/Only a draft/);
  });

  it("옛 버전 응시·답안·결과는 그대로이고 결과 화면 데이터를 계속 읽을 수 있다", () => {
    expect(psql(`select exam_set_id || '|' || status from mock_exam_attempts where id = '${attA1}';`)).toBe(`${v1}|graded`);
    expect(psql(`select count(*) from mock_exam_answers where attempt_id = '${attA1}';`)).toBe("4");
    const d = JSON.parse(asUser(sA, `select mock_exam_attempt_detail('${attA1}');`)) as { id: string; items: { problemId: string }[] };
    expect(d.id).toBe(attA1);
    expect(d.items.map((i) => i.problemId)).toContain(P.m2); // 옛 버전의 문항(교체되어 v2 에는 없음)
  });

  it("진행 중 응시는 새 버전이 공개돼도 바뀌지 않고 옛 버전으로 이어진다(새 응시 생성 없음)", () => {
    expect(start(sB, v2)).toBe(attB1); // v2 시작 요청 → 진행 중인 옛 응시를 이어서 돌려준다
    expect(psql(`select exam_set_id || '|' || status || '|' || is_updated_version_retake from mock_exam_attempts where id = '${attB1}';`)).toBe(`${v1}|in_progress|false`);
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${sB}';`)).toBe("1");
    const d = JSON.parse(asUser(sB, `select mock_exam_attempt_detail('${attB1}');`)) as { items: { problemId: string }[] };
    expect(d.items.map((i) => i.problemId)).toContain(P.m3); // 아직 옛 버전 문항
    expect(d.items.map((i) => i.problemId)).not.toContain(P.r2);
    // 진행 중 응시에도 답안 기록은 계속 가능(옛 버전 항목에).
    answer(attB1, v1, "ap_mc", 1, "3");
    expect(psql(`select count(*) from mock_exam_answers where attempt_id = '${attB1}';`)).toBe("2");
  });
});

describe("이미 응시한 학생: Updated version 정보·집계 제외·노출 구분", () => {
  let attA2: string, attC1: string;

  it("overview: 새 버전과 겹치고 이미 답한 문항 수 N(문항 identity 기준)을 준다. 신규 학생에게는 없다", () => {
    const a = JSON.parse(asUser(sA, `select mock_exam_updated_version_overview('${sA}');`)) as { examSetId: string; versionNo: number; itemTotal: number; sharedAnswered: number; priorVersionNo: number }[];
    // v2 문항: m1(답함) · r1 · r2 · f1(답함) → 공통 중 답한 것 2. m3 는 공란이었고 v2 에서 빠졌다. m2 는 답했지만 v2 에서 교체됨.
    expect(a).toEqual([{ examSetId: v2, versionNo: 2, itemTotal: 4, sharedAnswered: 2, priorVersionNo: 1 }]);
    const b = JSON.parse(asUser(sB, `select mock_exam_updated_version_overview('${sB}');`)) as { sharedAnswered: number }[];
    expect(b).toHaveLength(1);
    expect(b[0].sharedAnswered).toBe(1); // B 는 m1 에만 답함(m2 는 교체됨)
    expect(JSON.parse(asUser(sC, `select mock_exam_updated_version_overview('${sC}');`))).toEqual([]);
    expect(fails(() => asUser(sC, `select mock_exam_updated_version_overview('${sA}');`))).toContain("permission");
  });

  it("새 버전을 시작하면 재응시 회차(2)로 기록되고 '새 버전 재응시' 표식이 붙는다. 처음 푸는 학생은 표식이 없다", () => {
    attA2 = start(sA, v2);
    expect(psql(`select attempt_no || '|' || exam_set_id || '|' || is_updated_version_retake from mock_exam_attempts where id = '${attA2}';`)).toBe(`2|${v2}|true`);
    attC1 = start(sC, v2);
    expect(psql(`select attempt_no || '|' || is_updated_version_retake from mock_exam_attempts where id = '${attC1}';`)).toBe("1|false");
    // 같은 버전 일반 재응시는 표식이 없다.
    grade(attA2);
    const attA3 = start(sA, v2);
    expect(psql(`select attempt_no || '|' || is_updated_version_retake from mock_exam_attempts where id = '${attA3}';`)).toBe("3|true"); // 계열의 다른 버전 응시가 이전에 있으므로 계속 true
    grade(attA3);
  });

  it("결과 화면용 note: 새 버전 응시는 updatedVersion·N, 첫 응시는 false", () => {
    expect(JSON.parse(asUser(sA, `select mock_exam_attempt_version_note('${attA2}');`))).toEqual({ updatedVersion: true, versionNo: 2, itemTotal: 4, sharedAnswered: 2 });
    expect(JSON.parse(asUser(sC, `select mock_exam_attempt_version_note('${attC1}');`))).toEqual({ updatedVersion: false });
    expect(JSON.parse(asUser(sA, `select mock_exam_attempt_version_note('${attA1}');`))).toEqual({ updatedVersion: false });
  });

  it("문항 노출: 이전에 본 문항은 re_exposure, 새 문항은 first(학생별 최초 노출 1행)", () => {
    const kinds = JSON.parse(asUser(sA, `select mock_exam_attempt_item_exposure_kinds('${attA2}');`)) as { problemId: string; kind: string }[];
    const k = Object.fromEntries(kinds.map((x) => [x.problemId, x.kind]));
    expect(k[P.m1]).toBe("re_exposure");
    expect(k[P.f1]).toBe("re_exposure");
    expect(k[P.r1]).toBe("first");
    expect(k[P.r2]).toBe("first");
    expect(psql(`select count(*) from mock_exam_item_exposures where student_id = '${sA}';`)).toBe("6"); // m1 m2 m3 f1 r1 r2 — 문항당 1행
    expect(psql(`select exposure_count from mock_exam_item_exposures where student_id = '${sA}' and problem_id = '${P.m1}';`)).toBe("3"); // 1·2·3회차
    // 신규 학생 C 는 전부 최초 노출.
    const kc = JSON.parse(asUser(sC, `select mock_exam_attempt_item_exposure_kinds('${attC1}');`)) as { kind: string }[];
    expect(kc.every((x) => x.kind === "first")).toBe(true);
  });

  it("집계: 분석의 시험 시작·완료는 새 버전 재응시를 독립 시험으로 세지 않는다(중복 집계 없음)", () => {
    psql(`update mock_exam_attempts set started_at = now() where student_id in ('${sA}', '${sB}', '${sC}') and started_at is null;`);
    grade(attC1);
    const out = JSON.parse(asUser(ADMIN_ID, `select admin_free_accounts_analytics(current_date - 1, current_date + 1, true, array['${sA}', '${sB}', '${sC}']::uuid[]);`)) as { learning: { testsStarted: number; testsCompleted: number; startedCohortSize: number } };
    // 전체 응시 행: A 1·2·3회차, B 1, C 1 = 5. 새 버전 재응시(A 2·3회차) 제외 → 시작 3, 완료 2(A1·C1).
    expect(psql(`select count(*) from mock_exam_attempts where student_id in ('${sA}', '${sB}', '${sC}');`)).toBe("5");
    expect(out.learning.testsStarted).toBe(3);
    expect(out.learning.startedCohortSize).toBe(3);
    expect(out.learning.testsCompleted).toBe(2);
  });

  it("목록: 새 버전 공개 뒤에도 학생당 계열 한 줄(카탈로그 1행) — 응시 회차는 attemptTotal 로만 늘어난다", () => {
    const cat = JSON.parse(asUser(sA, `select mock_exam_open_catalog('${sA}');`)) as { examSetId: string; setGroupId: string; attemptNo: number; attemptTotal: number }[];
    const rows = cat.filter((c) => c.setGroupId === group);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ examSetId: v2, attemptNo: 3, attemptTotal: 3 });
  });

  it("마이그레이션 재실행 안전: 480~483 을 다시 적용해도 오류 없음", () => {
    for (const f of ["480_mock_exam_version_exposure", "482_mock_exam_updated_version_info"]) {
      execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", `supabase/migrations/20262100000${f}.sql`], { encoding: "utf-8", stdio: "pipe" });
    }
  });
});

describe("관리자 서버 액션 경로(createMockExamNewVersionAction → publishMockExamSet)", () => {
  it("조립 규칙 위반은 RPC 전에 거절되고, 정상 요청은 초안 생성 → 원자적 공개까지 동작한다", async () => {
    for (const n of ["x1", "x2", "xr1", "xr2"]) addCandidate(n);
    for (const n of ["x1", "x2", "xr1", "xr2"]) P[n] = convert(n, "mock_exam");
    const layout = { sections: [{ key: "ap_mc", kind: "mc", label: "Section I", minutes: 20, count: 2, calculator: "allowed", options: 4 }] };
    const setX = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout)
      values (${q(`${RUN}-X`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', ${q(AP_CODE)}, 'mc_practice', ${json(layout)}) returning id;`);
    addItem(setX, P.x1, "ap_mc", 1); addItem(setX, P.x2, "ap_mc", 2);
    psql(`update mock_exam_sets set status = 'published', published_at = now(), access_tier = 'free' where id = '${setX}';`);
    const { createMockExamNewVersionAction, publishMockExamSet } = await import("@/app/admin/mock-exam-actions");
    // 풀 모의고사가 아니므로 겹침 규칙은 없지만, 다른 슬롯 유형/없는 슬롯 등은 거절된다.
    await expect(createMockExamNewVersionAction(setX, [])).rejects.toThrow(/하나 이상/);
    await expect(createMockExamNewVersionAction(setX, [{ section: "ap_mc", position: 7, problemId: P.xr1 }])).rejects.toThrow(/slot_missing/);
    const r = await createMockExamNewVersionAction(setX, [{ section: "ap_mc", position: 2, problemId: P.xr1 }]);
    expect(r).toMatchObject({ versionNo: 2, swapped: 1 });
    await publishMockExamSet(r.newSetId);
    expect(psql(`select string_agg(version_no || ':' || status || ':' || access_tier, ',' order by version_no) from mock_exam_sets where name = ${q(`${RUN}-X`)};`)).toBe("1:archived:tutoring,2:published:free");
  });
});
