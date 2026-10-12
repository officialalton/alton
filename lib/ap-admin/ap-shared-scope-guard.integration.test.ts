import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 마이그레이션 20262100000500 — AB·BC 공통 범위(scope='both') 문항을 BC 세트에서 쓸 수 있는 세트 가드. 격리 스택에서만 실행한다(vitest.integration-guard.ts 가 SUPABASE_TEST_DB_URL 을 요구).
// 실행 ID 전용 주제 코드(91.x)·후보·세트만 만들고 afterAll 에서 실행 ID 단위로 지운다. 격리 DB 에 과목 행이 없으면 만들고, 있으면 재사용한다(만든 것만 지운다).
const DB_URL = process.env.SUPABASE_TEST_DB_URL!;
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `shs${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const OTHER = `ap_t_${RUN}`;
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const tryPsql = (sql: string) => { try { psql(sql); return null; } catch (e) { return String((e as { stderr?: string }).stderr ?? e); } };
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const K = (n: string) => `${RUN}-${n}`;
const LAYOUT = { sections: [{ key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 1, calculator: "allowed", options: 4 }] };
const subj: Record<string, string> = {}; const createdSubjects: string[] = [];
const prob: Record<string, { pid: string; vid: string; topic: string }> = {};

function ensureSubject(code: string, name: string) {
  const ex = psql(`select id from subjects where ap_subject_code = ${q(code)}`);
  if (ex) { subj[code] = ex; return; }
  subj[code] = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-${name}`)}, ${q(code)}) returning id;`);
  createdSubjects.push(subj[code]);
}
function keyword(code: string, topic: string, scope: string) {
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level, scope) values ('${subj[code]}', ${q(`${RUN} ${topic} ${code}`)}, ${q(`${RUN} ${topic} ${code}`)}, ${q(topic)}, 1, ${q(scope)});`);
}
function convert(name: string, code: string, topic: string) {
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, calculator)
        values (${q(K(name))}, ${q(RUN)}, '${subj[code]}', ${q(code)}, 'mc', ${q(topic)}, '1.A', 'standalone', 'select', 'exact', ${json({ stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } })}, 'auto_passed', true, true, 'na');`);
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, 'mock_exam', 'mc', '${ADMIN_ID}', 'medium', ${q(topic)});`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${json(["A1", "B2", "C3", "D4"])}, p_correct_index => 1, p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  prob[name] = { pid, vid, topic };
}
const draft = (setName: string, subject: string, item: string) =>
  `select ap_admin_create_draft_set(${q(`${RUN}-${setName}`)}, ${q(subject)}, 'full_practice', ${json(LAYOUT)}, ${json([{ section: "ap_mc", position: 1, problem_id: prob[item].pid, problem_version_id: prob[item].vid, sat_domain: `ap:${prob[item].topic}`, difficulty: "medium" }])});`;
const REJECT = /Only .* AP problems can be added to this exam set/;

beforeAll(() => {
  ensureSubject("ap_calculus_ab", "AB"); ensureSubject("ap_calculus_bc", "BC"); ensureSubject(OTHER, "Other");
  // 91.1: AB·BC 모두 both / 91.2: AB 에서 ab_only(BC 에는 both) / 91.3: BC 에서만 bc_only(AB 행 없음)
  keyword("ap_calculus_ab", "91.1", "both"); keyword("ap_calculus_bc", "91.1", "both");
  keyword("ap_calculus_ab", "91.2", "ab_only"); keyword("ap_calculus_bc", "91.2", "both");
  keyword("ap_calculus_bc", "91.3", "bc_only");
  keyword(OTHER, "91.1", "both");
  convert("abShared", "ap_calculus_ab", "91.1");
  convert("abOnly", "ap_calculus_ab", "91.2");
  convert("abShared2", "ap_calculus_ab", "91.1");
  convert("bcOnly", "ap_calculus_bc", "91.3");
  convert("bcShared", "ap_calculus_bc", "91.1");
  convert("other", OTHER, "91.1");
});
afterAll(() => {
  const ids = createdSubjects.map((s) => `'${s}'`).join(",") || "'00000000-0000-0000-0000-000000000000'";
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from ap_candidate_problems where candidate_key like '${RUN}-%';
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problem_versions where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problems where ap_candidate_key like '${RUN}-%';
    delete from ap_candidate_items where candidate_key like '${RUN}-%';
    delete from subject_keywords where label like '${RUN} %';
    delete from subjects where id in (${ids}) or ap_subject_code = '${OTHER}';
    commit;`);
});

describe("AB·BC 공통 범위 세트 가드", () => {
  it("공통 범위(both) AB 문항은 BC 초안 세트에 저장된다(ap_admin_create_draft_set)", () => {
    const id = psql(draft("bc-shared", "ap_calculus_bc", "abShared"));
    expect(psql(`select status || ',' || ap_subject from mock_exam_sets where id = '${id}'`)).toBe("draft,ap_calculus_bc");
  });
  it("같은 공통 범위 문항은 AB 세트에서도 쓸 수 있다(재사용 허용)", () => {
    expect(tryPsql(draft("ab-shared", "ap_calculus_ab", "abShared"))).toMatch(/already used in another full practice set/); // 풀 세트끼리 같은 문항 금지는 그대로
    expect(tryPsql(draft("ab-shared2", "ap_calculus_ab", "abShared2"))).toBeNull();
  });
  it("AB 전용(ab_only) 주제 문항은 BC 세트에 넣을 수 없다", () => {
    expect(tryPsql(draft("bc-abonly", "ap_calculus_bc", "abOnly"))).toMatch(REJECT);
    expect(psql(`select count(*) from mock_exam_sets where name = ${q(`${RUN}-bc-abonly`)}`)).toBe("0");
  });
  it("BC 전용 문항은 AB 세트에 들어가지 않는다(공통 주제의 BC 문항 포함)", () => {
    expect(tryPsql(draft("ab-bconly", "ap_calculus_ab", "bcOnly"))).toMatch(REJECT);
    expect(tryPsql(draft("ab-bcshared", "ap_calculus_ab", "bcShared"))).toMatch(REJECT);
  });
  it("BC 과목 문항은 BC 세트에 그대로 들어간다", () => {
    expect(tryPsql(draft("bc-native", "ap_calculus_bc", "bcOnly"))).toBeNull();
  });
  it("무관한 과목 조합은 계속 거부한다", () => {
    expect(tryPsql(draft("bc-other", "ap_calculus_bc", "other"))).toMatch(REJECT);
    expect(tryPsql(draft("other-ab", OTHER, "bcShared"))).toMatch(REJECT);
  });
  it("SAT 세트 거부 등 기존 가드는 유지: 같은 세트에 직접 INSERT 해도 같은 규칙", () => {
    const id = psql(draft("bc-direct", "ap_calculus_bc", "bcShared"));
    const err = tryPsql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
      values ('${id}', 'ap_mc', 2, '${prob.abOnly.pid}', '${prob.abOnly.vid}', 'ap:91.2', 'medium');`);
    expect(err).toMatch(REJECT);
  });
});
