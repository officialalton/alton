import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 마이그레이션 20262100000490(작업 이력)·491(초안 세트 원자 저장)의 DB 동작. 격리 스택에서만 실행한다(vitest.integration-guard.ts 가 SUPABASE_TEST_DB_URL 을 요구).
// 실행 ID 전용 과목·후보·세트만 만들고 afterAll 에서 실행 ID 단위로 지운다. 공식 계정·게시 세트는 건드리지 않는다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL!;
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `adm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const AP_CODE = `ap_t_${RUN}`;
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const tryPsql = (sql: string) => { try { psql(sql); return null; } catch (e) { return String((e as { stderr?: string }).stderr ?? e); } };
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const K = (n: string) => `${RUN}-${n}`;
const LAYOUT = { sections: [{ key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 2, calculator: "allowed", options: 4 }] };
let subjectId: string;
const pids: string[] = []; const vids: string[] = [];

function convert(name: string) {
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, calculator)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, 'mc', '1.1', '1.A', 'standalone', 'select', 'exact', ${json({ stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } })}, 'auto_passed', true, true, 'na');`);
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, 'mock_exam', 'mc', '${ADMIN_ID}', 'medium', '1.1');`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${json(["A1", "B2", "C3", "D4"])}, p_correct_index => 1, p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  pids.push(pid); vids.push(vid);
}
const items = (i: number[]) => i.map((n, pos) => ({ section: "ap_mc", position: pos + 1, problem_id: pids[n], problem_version_id: vids[n], sat_domain: "ap:1.1", difficulty: "medium" }));
const create = (name: string, label: string, idx: number[]) => `select ap_admin_create_draft_set(${q(name)}, ${q(AP_CODE)}, ${q(label)}, ${json(LAYOUT)}, ${json(items(idx))});`;

beforeAll(() => {
  subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP Admin`)}, ${q(AP_CODE)}) returning id;`);
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) values ('${subjectId}', ${q(`${RUN} topic`)}, ${q(`${RUN} topic`)}, '1.1', 1);`);
  for (const n of ["a", "b", "c"]) convert(n);
});
afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from ap_stock_admin_runs where note = '${RUN}';
    delete from ap_candidate_problems where candidate_key like '${RUN}-%';
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problem_versions where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problems where ap_candidate_key like '${RUN}-%';
    delete from ap_candidate_items where candidate_key like '${RUN}-%';
    delete from subject_keywords where subject_id = '${subjectId}';
    delete from subjects where id = '${subjectId}';
    commit;`);
});

describe("ap_admin_create_draft_set", () => {
  it("초안(draft)으로만 저장하고 문항 순서를 보존한다", () => {
    const id = psql(create(`${RUN}-set1`, "full_practice", [0, 1]));
    expect(psql(`select status || ',' || (select count(*) from mock_exam_set_items where exam_set_id = s.id) from mock_exam_sets s where id = '${id}'`)).toBe("draft,2");
  });
  it("같은 이름의 비보관 세트 · 풀 세트끼리 겹치는 문항은 거부하고 아무것도 남기지 않는다", () => {
    expect(tryPsql(create(`${RUN}-set1`, "full_practice", [2]))).toMatch(/duplicate set name/);
    expect(tryPsql(create(`${RUN}-set2`, "full_practice", [1, 2]))).toMatch(/already used in another full practice set/);
    expect(psql(`select count(*) from mock_exam_sets where name = ${q(`${RUN}-set2`)}`)).toBe("0");
  });
  it("부분 연습(mc_practice)은 겹침 규칙 대상이 아니다", () => {
    expect(tryPsql(create(`${RUN}-set3`, "mc_practice", [0]))).toBeNull();
  });
  it("service_role 외에는 실행할 수 없다", () => {
    expect(tryPsql(`set role authenticated; ${create(`${RUN}-set4`, "full_practice", [2])}`)).toMatch(/permission denied/);
  });
});

// 마이그레이션 520: 부분 연습 세트 초안은 비보관 AP 세트 전부(풀·부분)와 겹침 0.
const createPartial = (name: string, label: string, idx: number[]) => `select ap_admin_create_partial_draft_set(${q(name)}, ${q(AP_CODE)}, ${q(label)}, ${json(LAYOUT)}, ${json(items(idx))});`;
describe("ap_admin_create_partial_draft_set", () => {
  // 앞선 테스트가 문항 0·1 을 풀 세트(set1)에, 0 을 부분 세트(set3)에 이미 썼다. 문항 2 만 비어 있다.
  let pnew = "";
  it("겹침이 없으면 초안으로 저장, 같은 문항·같은 이름은 거부하고 아무것도 남기지 않는다", () => {
    pnew = psql(createPartial(`${RUN}-pnew`, "mc_practice", [2]));
    expect(psql(`select status || ',' || (select count(*) from mock_exam_set_items where exam_set_id = s.id) from mock_exam_sets s where id = '${pnew}'`)).toBe("draft,1");
    expect(tryPsql(createPartial(`${RUN}-pdup`, "mc_practice", [1]))).toMatch(/already used in another non-archived AP set/); // 풀 세트와 겹침
    expect(tryPsql(createPartial(`${RUN}-pdup2`, "frq_practice", [2]))).toMatch(/already used in another non-archived AP set/); // 부분 세트끼리 겹침
    expect(tryPsql(createPartial(`${RUN}-pnew`, "mc_practice", [2]))).toMatch(/duplicate set name/);
    expect(psql(`select count(*) from mock_exam_sets where name in (${q(`${RUN}-pdup`)}, ${q(`${RUN}-pdup2`)})`)).toBe("0");
  });
  it("보관한 세트의 문항·이름은 다시 쓸 수 있다", () => {
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${pnew}';`);
    expect(tryPsql(createPartial(`${RUN}-pnew`, "mc_practice", [2]))).toBeNull();
  });
  it("풀 라벨·service_role 외 실행은 거부", () => {
    expect(tryPsql(createPartial(`${RUN}-pbad`, "full_practice", [2]))).toMatch(/invalid partial ap_label/);
    expect(tryPsql(`set role authenticated; ${createPartial(`${RUN}-pbad2`, "mc_practice", [2])}`)).toMatch(/permission denied/);
  });
});

describe("ap_stock_admin_runs", () => {
  it("append-only: 관리자·일반 역할은 수정·삭제 권한이 없다", () => {
    psql(`insert into ap_stock_admin_runs (actor_id, action, mode, status, target_ref, note) values ('${ADMIN_ID}', 'load_check', 'dry_run', 'ok', 'local', ${q(RUN)});`);
    expect(tryPsql(`set role authenticated; update ap_stock_admin_runs set note = 'x' where note = ${q(RUN)};`)).toMatch(/permission denied/);
    expect(tryPsql(`set role authenticated; delete from ap_stock_admin_runs where note = ${q(RUN)};`)).toMatch(/permission denied/);
  });
  it("허용되지 않은 action 값은 거부", () => {
    expect(tryPsql(`insert into ap_stock_admin_runs (action, mode, status, target_ref) values ('publish', 'execute', 'ok', 'local');`)).toMatch(/check constraint/);
  });
});
