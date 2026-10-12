import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dockerPsSnapshot, verifySameIsolatedStack } from "@/lib/dev/stack-identity";

// 'AB/AP 세트 새 버전' 화면의 서버 액션 경로 + 공개 범위(무료/튜터링) RPC(마이그레이션 20262100000510). 격리 스택 전용(DB·API 가 같은 격리 project 인지 docker 로 확인).
// 실행 ID(RUN) 접두 과목·후보·세트·학생만 만들고 afterAll 에서 실행 ID 단위로 지운다. 공식 계정·게시 세트는 건드리지 않는다.
const LOCAL_DEMO_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ supabase: h.client, adminUserId: "aaaaaaaa-0000-0000-0000-000000000001" }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => h.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "";
const API_URL = process.env.SUPABASE_TEST_API_URL ?? "";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `nu${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const AP_CODE = `ap_t_${RUN}`;
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const fails = (fn: () => unknown): string => { try { fn(); } catch (e) { return String((e as { stderr?: string }).stderr ?? e); } return ""; };
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const K = (n: string) => `${RUN}-${n}`;
const P: Record<string, string> = {};
let subjectId: string; let v1: string; let student: string; let attempt: string;
const LAYOUT = { sections: [{ key: "ap_mc", kind: "mc", label: "Section I", minutes: 30, count: 3, calculator: "allowed", options: 4 }] };

function addConverted(name: string, purpose: "mock_exam" | "lesson" = "mock_exam") {
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, is_current, calculator)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, 'mc', '1.1', '1.A', 'standalone', 'select', 'exact', ${json({ stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } })}, 'auto_passed', true, true, true, 'na');`);
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, ${q(purpose)}, 'mc', '${ADMIN_ID}', 'medium', '1.1');`);
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${json(["A1", "B2", "C3", "D4"])}, p_correct_index => 1, p_explanation => 'Because B2 is correct. Detailed English explanation.', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_question => ${q(`Stem ${name}`)}, p_explanation_en => 'Because B2 is correct. Detailed English explanation.');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  P[name] = pid;
}
const addItem = (setId: string, pid: string, pos: number) => {
  const vid = psql(`select published_version_id from problems where id = '${pid}'`);
  psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', 'ap_mc', ${pos}, '${pid}', '${vid}', 'ap:1.1', 'medium');`);
};
const newSet = (name: string, label = "full_practice") => psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout)
  values (${q(`${RUN}-${name}`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', ${q(AP_CODE)}, ${q(label)}, ${json(LAYOUT)}) returning id;`);
const snapshot = (setId: string) => psql(`select s.status || '|' || s.version_no || '|' || (select string_agg(i.position || ':' || i.problem_id, ',' order by i.position) from mock_exam_set_items i where i.exam_set_id = s.id) from mock_exam_sets s where s.id = '${setId}'`);
const attemptsOf = (setId: string) => psql(`select count(*) || '|' || coalesce(string_agg(id::text || ':' || status || ':' || exam_set_id::text, ',' order by id), '') from mock_exam_attempts where exam_set_id = '${setId}'`);

beforeAll(() => {
  if (!DB_URL || !API_URL) throw new Error("SUPABASE_TEST_DB_URL 과 SUPABASE_TEST_API_URL 을 격리 스택으로 명시해야 한다.");
  const r = verifySameIsolatedStack({ dbUrl: DB_URL, apiUrls: [API_URL], dockerPs: dockerPsSnapshot() });
  if (!r.ok) throw new Error(`격리 스택이 아니다: ${r.reasons.join(" ")}`);
  h.client = createClient(API_URL, LOCAL_DEMO_SERVICE_KEY);
  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL; process.env.AP_STOCK_ADMIN_ALLOWED_REFS = "local"; delete process.env.AP_STOCK_ADMIN_BLOCKED_REFS; delete process.env.VERCEL_ENV;

  subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP`)}, ${q(AP_CODE)}) returning id;`);
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) values ('${subjectId}', ${q(`${RUN} kw`)}, ${q(`${RUN} kw`)}, '1.1', 1);`);
  for (const n of ["m1", "m2", "m3", "r1", "r2"]) addConverted(n);
  addConverted("lesson1", "lesson");
  v1 = newSet("Full");
  addItem(v1, P.m1, 1); addItem(v1, P.m2, 2); addItem(v1, P.m3, 3);
  psql(`update mock_exam_sets set status = 'published', published_at = now(), access_tier = 'free' where id = '${v1}';`);
  student = psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-s@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`);
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${student}', 'student', '${RUN}-s', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${student}', 'active', 'free', 'self_signup', '10th', now());`);
  attempt = psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${student}', false); end $$; select mock_exam_open_start('${v1}'); reset role;`);
});
afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_answers where attempt_id in (select id from mock_exam_attempts where student_id = '${student}');
    delete from mock_exam_item_exposures where student_id = '${student}';
    delete from mock_exam_attempts where student_id = '${student}';
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from ap_stock_admin_runs where scope::text like '%${RUN}%' or note like '%${RUN}%';
    delete from ap_candidate_problems where candidate_key like '${RUN}-%';
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problem_versions where problem_id in (select id from problems where ap_candidate_key like '${RUN}-%');
    delete from problems where ap_candidate_key like '${RUN}-%';
    delete from ap_candidate_items where candidate_key like '${RUN}-%';
    delete from students where id = '${student}'; delete from profiles where id = '${student}'; delete from auth.users where id = '${student}';
    delete from subject_keywords where subject_id = '${subjectId}'; delete from subjects where id = '${subjectId}';
    commit;`);
});

describe("새 버전 액션 경로(미리보기 → 초안 → 공개)", () => {
  let hash: string; let v2: string; let before: { v1: string; att: string };
  it("개요에 공개 세트가 나오고, 미리보기는 읽기 전용이며 기존 응시 수를 보여 준다", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    const ov = await a.getApNewVersionOverviewAction();
    expect(ov.target.canWrite).toBe(true);
    expect(ov.sets.find((s) => s.id === v1)).toMatchObject({ status: "published", accessTier: "free", versionNo: 1 });
    before = { v1: snapshot(v1), att: attemptsOf(v1) };
    expect(before.att.startsWith("1|")).toBe(true);
    const p = await a.apNewVersionPreviewAction({ sourceSetId: v1, manual: [{ section: "ap_mc", position: 2, addKey: K("r1") }] });
    expect(p.ok).toBe(true); expect(p.planHash).toBeTruthy(); hash = p.planHash!;
    expect(p.preview).toMatchObject({ newVersionNo: 2, attempts: { total: 1 } });
    expect(p.preview!.swaps[0]).toMatchObject({ position: 2, removeKey: K("m2"), addKey: K("r1") });
    expect(p.preview!.before.mc).toBe(3); expect(p.preview!.after.mc).toBe(3);
    expect(snapshot(v1)).toBe(before.v1); expect(psql(`select count(*) from mock_exam_sets where name = ${q(`${RUN}-Full`)}`)).toBe("1");
  });
  it("검증 위반(없는 문항·수업용·이미 들어 있는 문항·없는 슬롯)은 미리보기에서 계획 해시 없이 거절", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    for (const m of [{ section: "ap_mc", position: 1, addKey: K("nope") }, { section: "ap_mc", position: 1, addKey: K("lesson1") }, { section: "ap_mc", position: 1, addKey: K("m2") }, { section: "ap_mc", position: 9, addKey: K("r1") }]) {
      const p = await a.apNewVersionPreviewAction({ sourceSetId: v1, manual: [m] });
      expect(p.ok, JSON.stringify(m)).toBe(false); expect(p.planHash).toBeNull();
    }
  });
  it("미리보기 해시가 없거나 다르면 초안을 만들지 않는다", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    const none = await a.apNewVersionDraftAction({ sourceSetId: v1, planHash: null, manual: [{ section: "ap_mc", position: 2, addKey: K("r1") }] });
    expect(none.executed).toBe(false); expect(none.blocked).toMatch(/미리보기/);
    const stale = await a.apNewVersionDraftAction({ sourceSetId: v1, planHash: "stale", manual: [{ section: "ap_mc", position: 2, addKey: K("r1") }] });
    expect(stale.executed).toBe(false); expect(stale.blocked).toMatch(/달라졌습니다/);
    expect(psql(`select count(*) from mock_exam_sets where name = ${q(`${RUN}-Full`)}`)).toBe("1");
  });
  it("확인된 계획으로 v2 초안 생성(기존 createMockExamNewVersionAction) — v1·응시 불변, 초안은 비공개", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    const r = await a.apNewVersionDraftAction({ sourceSetId: v1, planHash: hash, manual: [{ section: "ap_mc", position: 2, addKey: K("r1") }] });
    expect(r.executed, r.blocked ?? "").toBe(true); v2 = String(r.scope.newSetId);
    expect(r.scope.versionNo).toBe(2);
    expect(snapshot(v1)).toBe(before.v1); expect(attemptsOf(v1)).toBe(before.att);
    expect(psql(`select status || '|' || version_no || '|' || access_tier from mock_exam_sets where id = '${v2}'`)).toBe("draft|2|tutoring");
    expect(psql(`select string_agg(position || ':' || problem_id, ',' order by position) from mock_exam_set_items where exam_set_id = '${v2}'`)).toBe(`1:${P.m1},2:${P.r1},3:${P.m3}`);
  });
  it("공개 단계는 별도: 미리보기 → 확인 해시로 원자 공개, 이전 공개본 보관·범위 승계, 응시는 v1 에 남는다", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    const early = await a.apNewVersionPublishAction({ newSetId: v2, execute: true, planHash: null });
    expect(early.executed).toBe(false);
    const pv = await a.apNewVersionPublishAction({ newSetId: v2, execute: false });
    expect(pv.ok).toBe(true); expect(pv.planHash).toBeTruthy();
    const ex = await a.apNewVersionPublishAction({ newSetId: v2, execute: true, planHash: pv.planHash });
    expect(ex.executed, ex.blocked ?? "").toBe(true);
    expect(psql(`select string_agg(version_no || ':' || status || ':' || access_tier, ',' order by version_no) from mock_exam_sets where name = ${q(`${RUN}-Full`)}`)).toBe("1:archived:tutoring,2:published:free");
    expect(attemptsOf(v1)).toBe(before.att);
    expect(psql(`select count(*) from mock_exam_attempts where exam_set_id = '${v2}'`)).toBe("0");
  });
  it("감사 로그: 미리보기·초안·공개가 남는다", () => {
    const rows = psql(`select string_agg(distinct action || ':' || mode, ',' order by action || ':' || mode) from ap_stock_admin_runs where scope::text like '%${RUN}%' or scope::text like '%${v1}%' or scope::text like '%${v2}%'`);
    expect(rows).toContain("new_version_preview:dry_run"); expect(rows).toContain("new_version_draft:execute"); expect(rows).toContain("new_version_publish:execute");
  });
  it("쓰기 차단 환경(허용 목록 비움)에서는 execute 가 거부된다", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    process.env.AP_STOCK_ADMIN_ALLOWED_REFS = "";
    try {
      const r = await a.apNewVersionDraftAction({ sourceSetId: v2, planHash: "x", manual: [{ section: "ap_mc", position: 1, addKey: K("r2") }] });
      expect(r.executed).toBe(false); expect(r.blocked).toMatch(/허용 목록/);
      const t = await a.apSetAccessTierAction({ setId: v2, tier: "tutoring", execute: true, planHash: "x" });
      expect(t.executed).toBe(false);
    } finally { process.env.AP_STOCK_ADMIN_ALLOWED_REFS = "local"; }
    expect(psql(`select access_tier from mock_exam_sets where id = '${v2}'`)).toBe("free");
  });
});

describe("공개 범위(무료/튜터링) — 마이그레이션 510", () => {
  const tier = (id: string) => psql(`select access_tier || '|' || coalesce(planned_access_tier, '-') || '|' || status from mock_exam_sets where id = '${id}'`);
  let d: string;
  it("초안은 planned_access_tier 에 기록되고 공개 때 적용된다(DB 가드 때문에 초안은 free 로 저장 불가)", () => {
    d = newSet("Draft1");
    addItem(d, P.r1, 1); addItem(d, P.r2, 2); addItem(d, P.m1, 3);
    expect(tier(d)).toBe("tutoring|-|draft");
    expect(fails(() => psql(`update mock_exam_sets set access_tier = 'free' where id = '${d}'`))).toMatch(/무료 공개는/);
    const r = JSON.parse(psql(`select ap_admin_set_access_tier('${d}', 'free', '${ADMIN_ID}');`));
    expect(r).toMatchObject({ status: "draft", previousTier: "tutoring", tier: "free" });
    expect(tier(d)).toBe("tutoring|free|draft");
  });
  it("공개 RPC 가 계획 범위를 적용한다(이전 공개본이 없을 때)", () => {
    // m1 은 v2 에 들어 있는 풀 세트 문항이라 겹침이 있지만 직접 INSERT 로 만든 세트는 DB 겹침 규칙 대상이 아니다.
    psql(`select mock_exam_publish_set('${d}', '${ADMIN_ID}');`);
    expect(tier(d)).toBe("free|free|published");
  });
  it("공개 중 세트: 튜터링 ↔ 무료 전환(액션 미리보기 → 확인 해시 → 적용), 내용·응시 불변", async () => {
    const a = await import("@/app/admin/ap-new-version-actions");
    const content = snapshot(d); const att = attemptsOf(d);
    const pv = await a.apSetAccessTierAction({ setId: d, tier: "tutoring", execute: false });
    expect(pv.ok).toBe(true); expect(tier(d)).toBe("free|free|published");
    const bad = await a.apSetAccessTierAction({ setId: d, tier: "tutoring", execute: true, planHash: "stale" });
    expect(bad.executed).toBe(false); expect(tier(d)).toBe("free|free|published");
    const ex = await a.apSetAccessTierAction({ setId: d, tier: "tutoring", execute: true, planHash: pv.planHash });
    expect(ex.executed, ex.blocked ?? "").toBe(true); expect(tier(d)).toBe("tutoring|free|published");
    const back = await a.apSetAccessTierAction({ setId: d, tier: "free", execute: false });
    const ex2 = await a.apSetAccessTierAction({ setId: d, tier: "free", execute: true, planHash: back.planHash });
    expect(ex2.executed).toBe(true); expect(tier(d)).toBe("free|free|published");
    expect(snapshot(d)).toBe(content); expect(attemptsOf(d)).toBe(att);
    expect(psql(`select count(*) from ap_stock_admin_runs where action = 'set_access_tier' and scope->>'setId' = '${d}'`)).toBe("5");
  });
  it("보관·비AP·잘못된 값·비관리자는 거부", async () => {
    const arch = newSet("Arch"); psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${arch}'`);
    expect(fails(() => psql(`select ap_admin_set_access_tier('${arch}', 'free', '${ADMIN_ID}');`))).toMatch(/Archived/);
    expect(fails(() => psql(`select ap_admin_set_access_tier('${d}', 'paid', '${ADMIN_ID}');`))).toMatch(/Invalid access tier/);
    expect(fails(() => psql(`select ap_admin_set_access_tier('${d}', 'free', '${student}');`))).toMatch(/Only an admin/);
    const sat = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program) values (${q(`${RUN}-SAT`)}, 'standard', 'draft', 'fixed', 'not_applicable', 'sat') returning id;`);
    expect(fails(() => psql(`select ap_admin_set_access_tier('${sat}', 'free', '${ADMIN_ID}');`))).toMatch(/Only AP/);
    expect(fails(() => psql(`set role authenticated; select ap_admin_set_access_tier('${d}', 'free', '${ADMIN_ID}');`))).toMatch(/permission denied/);
    const a = await import("@/app/admin/ap-new-version-actions");
    expect((await a.apSetAccessTierAction({ setId: arch, tier: "free", execute: false })).ok).toBe(false);
  });
  it("조립 초안 저장의 공개 범위(runAssemble 경로와 같은 RPC 호출): 기본값 무료로 적어 두면 공개 때 무료", () => {
    const x = newSet("Draft2"); addItem(x, P.r1, 1); addItem(x, P.r2, 2); addItem(x, P.m3, 3);
    psql(`select ap_admin_set_access_tier('${x}', 'free', '${ADMIN_ID}');`);
    psql(`select mock_exam_publish_set('${x}', '${ADMIN_ID}');`);
    expect(tier(x)).toBe("free|free|published");
  });
});
