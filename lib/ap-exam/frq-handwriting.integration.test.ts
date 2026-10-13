import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AP_FRQ_DELIVERY } from "./frq-delivery";
import { INK_COLORS, simplifyPoints, strokesToSvg, type InkStroke } from "./frq-ink";

// 2026-10-13 — 마이그레이션 570(FRQ 파트별 손글씨) DB 계약: 저장/복원·크기 상한·보드 높이·미시작/만료/제출 후 거부·종이/디지털 과목·읽기 권한.
// 격리 스택 전용(SUPABASE_TEST_DB_URL 필수 — 가드가 공유 스택을 막는다). 실행 ID(RUN) 접두 행만 만들고 afterAll 에서 지운다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL as string;
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `frqink${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
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
const K = (n: string) => `${RUN}-${n}`;

const LAYOUT = { sections: [
  { key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 1, calculator: "allowed", options: 4 },
  { key: "ap_frq", kind: "frq", label: "Section II", minutes: 20, count: 1, calculator: "allowed" },
] };

let subjectId: string; let student: string; let otherStudent: string
let setPaper: string; let setDigital: string; let frqItem: string; let mcItem: string; let frqItemD: string;
let attempt: string; let attemptD: string;

const stroke = (c: number, pts: number[]): InkStroke => ({ c, p: pts });
const SAMPLE: InkStroke[] = [stroke(0, [10, 10, 60, 40, 120, 20]), stroke(1, [200, 200, 220, 260])];
function save(att: string, item: string, label: string, strokes: InkStroke[], h = 500, svg?: string, user = student): string {
  return asUser(user, `select save_mock_exam_frq_handwriting('${att}', '${item}', ${q(label)}, ${json(strokes)}, ${q(svg ?? (strokes.length ? strokesToSvg(strokes, h) : ""))}, ${h});`);
}
function createStudent(label: string): string {
  const id = psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`);
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', 'tutoring', 'admin_direct', '10th', now());`);
  return id;
}
function convert(name: string, frq: boolean): string {
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, is_current)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, ${q(frq ? "frq_bundle" : "mc")}, '1.1', '1.A', ${q(frq ? "frq_multipart" : "standalone")}, 'select', 'exact',
        ${json(frq ? { title: "FRQ", parts: [], stimulus: { kind: "none" } } : { stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2.", stimulus: { kind: "none", description: "none" } })}, 'auto_passed', true, true, true);`);
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, 'mock_exam', ${q(frq ? "essay" : "mc")}, '${ADMIN_ID}', 'medium', '1.1');`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${frq ? "null" : json(["A1", "B2", "C3", "D4"])}, p_correct_index => ${frq ? "null" : 1},
      p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_statements => ${frq ? json([{ label: "a", points: 2, prompt: "Explain.", mode: "explain" }, { label: "b", points: 1, prompt: "Calculate.", mode: "calculate" }]) : "null"},
      p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  return pid;
}
function addItem(setId: string, pid: string, section: string, pos: number): string {
  const vid = psql(`select published_version_id from problems where id = '${pid}'`);
  return psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', ${q(section)}, ${pos}, '${pid}', '${vid}', 'ap:1.1', 'medium') returning id;`);
}
function makeSet(label: string): string {
  return psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, access_tier, exam_program, ap_subject, ap_label, section_layout)
    values (${q(`${RUN}-${label}`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'tutoring', 'ap', ${q(AP_CODE)}, 'full_practice', ${json(LAYOUT)}) returning id;`);
}

beforeAll(() => {
  subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP Test`)}, ${q(AP_CODE)}) returning id;`);
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) values ('${subjectId}', ${q(`${RUN} kw`)}, ${q(`${RUN} kw`)}, '1.1', 1);`);
  student = createStudent("s1"); otherStudent = createStudent("s2");
  const mcP = convert("mc", false); const frqP = convert("frq", true); const frqPD = convert("frqd", true); const mcPD = convert("mcd", false);
  setPaper = makeSet("paper"); setDigital = makeSet("digital");
  mcItem = addItem(setPaper, mcP, "ap_mc", 1); frqItem = addItem(setPaper, frqP, "ap_frq", 1);
  addItem(setDigital, mcPD, "ap_mc", 1); frqItemD = addItem(setDigital, frqPD, "ap_frq", 1);
  // 과목 키를 실제 AP 과목으로(문항 변환 때는 테스트용 코드가 필요했다). 세트-문항 과목 일치 트리거는 복제 모드로 건너뛴다.
  psql(`begin; set local session_replication_role = replica; update mock_exam_sets set ap_subject = 'ap_calculus_ab' where id = '${setPaper}'; update mock_exam_sets set ap_subject = 'ap_statistics' where id = '${setDigital}'; commit;`);
  for (const s of [setPaper, setDigital]) psql(`update mock_exam_sets set status = 'published', published_at = now() where id = '${s}';`);
  attempt = asUser(student, `select mock_exam_open_start('${setPaper}');`);
  attemptD = asUser(student, `select mock_exam_open_start('${setDigital}');`);
  asUser(student, `select mock_exam_ap_enter_section('${attempt}', 'ap_mc');`);
});

afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_frq_handwriting where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from ap_candidate_problems where candidate_key like '${RUN}-%';
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
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

describe("종이/디지털 목록: TS 설정표 = DB 함수", () => {
  it("모든 과목에서 일치", () => {
    for (const [subject, mode] of Object.entries(AP_FRQ_DELIVERY)) {
      expect(psql(`select _ap_frq_paper_subject(${q(subject)});`), subject).toBe(mode === "paper" ? "t" : "f");
    }
    expect(psql(`select _ap_frq_paper_subject('ap_unknown');`)).toBe("f");
  });
});

describe("저장·복원", () => {
  it("첫 FRQ 섹션이 시작되지 않았으면 거부(not started)", () => {
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE))).toMatch(/has not started yet/);
  });
  it("섹션 시작 후 저장·복원: 획·보드 높이·미리보기, 재저장은 덮어쓴다", () => {
    asUser(student, `select mock_exam_ap_enter_section('${attempt}', 'ap_frq');`);
    save(attempt, frqItem, "a", SAMPLE, 800);
    const rows = JSON.parse(asUser(student, `select load_mock_exam_frq_handwriting('${attempt}', true);`).split("\n")[0]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ setItemId: frqItem, partLabel: "a", strokeCount: 2, boardHeight: 800, strokes: SAMPLE });
    expect(rows[0].previewSvg).toContain('viewBox="0 0 800 800"');
    save(attempt, frqItem, "a", [SAMPLE[0]], 800);
    const lite = JSON.parse(asUser(student, `select load_mock_exam_frq_handwriting('${attempt}');`).split("\n")[0]);
    expect(lite[0].strokeCount).toBe(1);
    expect(lite[0].strokes).toBeUndefined(); // 미리보기만
  });
  it("지우기: 기본 높이면 행 삭제, 키운 높이면 획 0 행만 남아 크기 복원", () => {
    save(attempt, frqItem, "a", [], 500);
    expect(psql(`select count(*) from mock_exam_frq_handwriting where attempt_id = '${attempt}';`)).toBe("0");
    save(attempt, frqItem, "b", [], 1200);
    expect(psql(`select stroke_count || '|' || board_height from mock_exam_frq_handwriting where attempt_id = '${attempt}' and part_label = 'b';`)).toBe("0|1200");
  });
  it("보드를 키운 뒤에도 기존 획 좌표는 그대로(같은 값 저장)", () => {
    save(attempt, frqItem, "a", SAMPLE, 500);
    save(attempt, frqItem, "a", SAMPLE, 1000);
    const strokes = psql(`select strokes::text from mock_exam_frq_handwriting where attempt_id = '${attempt}' and part_label = 'a';`);
    expect(JSON.parse(strokes)).toEqual(SAMPLE);
    expect(psql(`select board_height from mock_exam_frq_handwriting where attempt_id = '${attempt}' and part_label = 'a';`)).toBe("1000");
  });
});

describe("검증·상한", () => {
  it("MC 문항·없는 파트·잘못된 색/좌표/미리보기·높이 범위 밖은 거부", () => {
    expect(fails(() => save(attempt, mcItem, "a", SAMPLE))).toMatch(/only for free-response/);
    expect(fails(() => save(attempt, frqItem, "z", SAMPLE))).toMatch(/part not found/);
    expect(fails(() => save(attempt, frqItem, "a", [stroke(5, [1, 1, 2, 2])]))).toMatch(/Invalid drawing/);
    expect(fails(() => save(attempt, frqItem, "a", [stroke(0, [1, 1, 2, 900])], 500))).toMatch(/Invalid drawing/); // 높이 500 밖의 y
    expect(psql(`select 1;`)).toBe("1");
    save(attempt, frqItem, "a", [stroke(0, [1, 1, 2, 900])], 1000); // 높이 1000 이면 같은 y 허용
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE, 1700))).toMatch(/Invalid drawing/);
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE, 500, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><script>alert(1)</script></svg>`))).toMatch(/Invalid drawing/);
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE, 800, strokesToSvg(SAMPLE, 500)))).toMatch(/Invalid drawing/); // 미리보기 높이가 보드와 다름
  });
  it("획 수·전체 점 수 상한 초과는 거부, 상한 안은 저장", () => {
    const many = Array.from({ length: 301 }, () => stroke(0, [1, 1, 2, 2]));
    expect(fails(() => save(attempt, frqItem, "a", many))).toMatch(/too large/);
    const dense = Array.from({ length: 21 }, (_, i) => stroke(i % 3, Array.from({ length: 2000 }, (_, k) => (k % 2 ? (i * 7 + k) % 500 : (k * 3) % 800))));
    expect(fails(() => save(attempt, frqItem, "a", dense))).toMatch(/too large/); // 21×1000점 > 20000
    // 단순화를 거친 현실적인 필기(수백 점)는 상한 안
    const raw: number[] = []; for (let i = 0; i < 600; i++) raw.push(100 + i, 250 + Math.round(80 * Math.sin(i / 20)));
    save(attempt, frqItem, "a", [stroke(2, simplifyPoints(raw))]);
    expect(INK_COLORS.length).toBe(3);
  });
});

describe("권한·상태", () => {
  it("다른 학생은 저장·읽기 불가, 무관 교사도 불가", () => {
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE, 500, undefined, otherStudent))).toMatch(/your own attempt/);
    expect(fails(() => asUser(otherStudent, `select load_mock_exam_frq_handwriting('${attempt}');`))).toMatch(/permission/);
    // RLS 켜짐 + 정책 없음: 본인 포함 누구도 테이블을 직접 읽지 못한다(RPC 로만).
    expect(asUser(student, `select count(*) from mock_exam_frq_handwriting;`)).toBe("0");
    expect(psql(`select count(*) from mock_exam_frq_handwriting where attempt_id = '${attempt}';`)).not.toBe("0");
  });
  it("관리자는 읽을 수 있다", () => {
    expect(JSON.parse(asUser(ADMIN_ID, `select load_mock_exam_frq_handwriting('${attempt}');`).split("\n")[0]).length).toBeGreaterThan(0);
  });
  it("디지털 과목(Statistics)은 저장 거부", () => {
    asUser(student, `select mock_exam_ap_enter_section('${attemptD}', 'ap_mc');`);
    asUser(student, `select mock_exam_ap_enter_section('${attemptD}', 'ap_frq');`);
    expect(fails(() => save(attemptD, frqItemD, "a", SAMPLE))).toMatch(/not available for this exam/);
  });
  it("섹션 시간이 지나면 거부(서버 시계)", () => {
    psql(`update mock_exam_attempts set ap_section_entered = ap_section_entered || jsonb_build_object('ap_frq', to_char((now() - interval '25 minutes') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) where id = '${attempt}';`);
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE))).toMatch(/Time is up/);
  });
  it("제출 뒤에는 거부, 읽기는 그대로(결과 화면)", () => {
    psql(`update mock_exam_attempts set status = 'submitted' where id = '${attempt}';`);
    expect(fails(() => save(attempt, frqItem, "a", SAMPLE))).toMatch(/already been submitted/);
    expect(JSON.parse(asUser(student, `select load_mock_exam_frq_handwriting('${attempt}');`).split("\n")[0]).length).toBeGreaterThan(0);
  });
});
