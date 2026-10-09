import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 관리자 모의고사 화면용 AP 읽기 함수(마이그레이션 20262100000421): 세트 문항 합계·AP 과목 목록·과목별 풀 현황.
// 실행 ID 전용 과목·후보·세트만 만들고 afterAll 에서 지운다. 읽기 함수 호출만 한다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `app${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const AP_CODE = `ap_t_${RUN}`;
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const K = (n: string) => `${RUN}-${n}`;
let subjectId: string;
let setId: string;

function addCandidate(name: string, o: { keyword?: string; calculator?: string; flags?: string[] } = {}) {
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, calculator, defect_flags)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, 'mc', ${q(o.keyword ?? "1.1")}, '1.A', 'standalone', 'select', 'exact',
        ${json({ stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } })},
        'auto_passed', true, true, ${q(o.calculator ?? "na")}, ${q(`{${(o.flags ?? []).join(",")}}`)}::text[]);`);
}
function convert(name: string, purpose: "mock_exam" | "lesson"): string {
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, ${q(purpose)}, 'mc', '${ADMIN_ID}', 'medium', '1.1');`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${json(["A1", "B2", "C3", "D4"])}, p_correct_index => 1,
      p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  return pid;
}

beforeAll(() => {
  subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP Pool`)}, ${q(AP_CODE)}) returning id;`);
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) values ('${subjectId}', ${q(`${RUN} topic`)}, ${q(`${RUN} topic`)}, '1.1', 1);`);
  for (const n of ["cand1", "mock1", "mock2", "lesson1"]) addCandidate(n, { calculator: n === "mock2" ? "required" : "na" });
  addCandidate("bad", { flags: ["unbalanced_braces"] });
  addCandidate("other", { keyword: "2.3" });
  const m1 = convert("mock1", "mock_exam");
  convert("mock2", "mock_exam");
  convert("lesson1", "lesson");
  setId = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout)
    values (${q(`${RUN}-set`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', ${q(AP_CODE)}, 'mc_practice', ${json({ sections: [{ key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 2, calculator: "allowed", options: 4 }] })}) returning id;`);
  const vid = psql(`select published_version_id from problems where id = '${m1}'`);
  psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', 'ap_mc', 1, '${m1}', '${vid}', 'ap:1.1', 'medium');`);
});
afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_set_items where exam_set_id = '${setId}';
    delete from mock_exam_sets where id = '${setId}';
    delete from ap_candidate_problems where candidate_key like '${RUN}-%';
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problem_versions where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problems where ap_candidate_key like '${RUN}-%';
    delete from ap_candidate_items where candidate_key like '${RUN}-%';
    delete from subject_keywords where subject_id = '${subjectId}';
    delete from subjects where id = '${subjectId}';
    commit;`);
});

type Pool = {
  topics: { unit: string; keyword_code: string; topic_label: string | null; stock: number; candidate: number; mock_exam: number; lesson: number; review_env: number; assigned_draft: number; assigned_published: number }[];
  byCalculator: { key: string; stock: number; mock_exam: number }[];
  totals: { stock: number; mockExam: number; lesson: number; assignedDraft: number; assignedPublished: number };
};

describe("관리자 AP 읽기 함수", () => {
  it("세트 문항 합계는 섹션별 수를 함께 준다", () => {
    const r = JSON.parse(psql(`select to_jsonb(t) from mock_exam_set_item_totals() t where exam_set_id = '${setId}';`));
    expect(r).toMatchObject({ total_count: 1, section_counts: { ap_mc: 1 } });
  });
  it("AP 과목 목록에는 재고가 있는 과목만 나온다", () => {
    expect(psql(`select stock || ',' || converted from mock_exam_ap_pool_subjects() where subject = ${q(AP_CODE)};`)).toBe("5,3");
    expect(psql(`select count(*) from mock_exam_ap_pool_subjects() where subject = 'ap_never_${RUN}';`)).toBe("0");
  });
  it("과목별 풀: 토픽·용도·단계·배정·계산기·결함 제외를 한 번에 센다", () => {
    const p = JSON.parse(psql(`select mock_exam_ap_pool(${q(AP_CODE)})::text;`)) as Pool;
    const t11 = p.topics.find((t) => t.keyword_code === "1.1")!;
    expect(t11).toMatchObject({ unit: "1", stock: 4, candidate: 1, mock_exam: 2, lesson: 1, review_env: 2, assigned_draft: 1, assigned_published: 0, topic_label: `${RUN} topic` });
    expect(p.topics.find((t) => t.keyword_code === "2.3")).toMatchObject({ stock: 1, candidate: 1, mock_exam: 0, topic_label: null });
    expect(p.byCalculator.find((c) => c.key === "required")).toMatchObject({ stock: 1, mock_exam: 1 });
    expect(p.totals).toMatchObject({ stock: 5, mockExam: 2, lesson: 1, assignedDraft: 1, assignedPublished: 0 });
  });
  it("다른 과목 값은 빈 풀이다", () => {
    const p = JSON.parse(psql(`select mock_exam_ap_pool('ap_never_${RUN}')::text;`)) as Pool;
    expect(p.topics).toEqual([]);
    expect(p.totals.stock).toBe(0);
  });
});
