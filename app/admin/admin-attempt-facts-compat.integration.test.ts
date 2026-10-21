// @vitest-environment jsdom
import { createElement } from "react";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ADMIN_ID, answer, asUser, assign, createRoutingSet, fails, psql, start, submitModule } from "../../test/mock-exam-routing-fixture";

// 2026-10-21 — 관리자 응시 이력 RPC(마이그레이션 640 적용 후)와 "코드 쪽 컴포넌트" 조합 호환 점검.
// 같은 테스트를 (a) origin/main 의 컴포넌트·변환 코드, (b) 수정 브랜치 코드로 각각 실행해 결과를 JSON 으로 남긴다(COMPAT_OUT).
// 격리 스택 전용(SUPABASE_TEST_DB_URL). 실행 ID(RUN) 전용 계정·세트만 만들고 종료 시 정리한다.
const RUN = `acf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const AP_CODE = process.env.COMPAT_AP_CODE ?? "ap_english_language";
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const K = (n: string) => `${RUN}-${n}`;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/essay-grading/actions", () => ({ enqueueEssayGradingAction: vi.fn() }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({ loadMockExamAnnotationsAction: vi.fn(async () => ({})), toggleMockExamSavedToPracticeAction: vi.fn() }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => []) }));
vi.mock("@/lib/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => null }));

// 서버 액션 대체: 실제 RPC 를 관리자(ADMIN_ID)로 호출한다.
const adminJson = (sql: string): unknown => JSON.parse(asUser(ADMIN_ID, sql).split("\n").filter((l) => l.startsWith("{") || l.startsWith("[") || l === "null")[0] ?? "null");
vi.mock("./free-accounts-actions", async () => {
  const { factsFromRpcRows } = await import("@/lib/free-accounts/facts");
  const detail = async (id: string) => {
    const d = adminJson(`select mock_exam_attempt_detail('${id}')::text;`) as { items: unknown[] | null; format?: string } | null;
    return d ? { ...d, items: Array.isArray(d.items) ? d.items : [] } : null;
  };
  return {
    getStudentAttemptFactsAction: async (sid: string) =>
      factsFromRpcRows(adminJson(`select coalesce(json_agg(f), '[]'::json)::text from admin_student_mock_attempt_facts('${sid}') f;`) as never),
    getAttemptDetailForAdminAction: detail,
    getApAttemptViewForAdminAction: async (id: string) => {
      const d = (await detail(id)) as { examProgram?: string } | null;
      return d && d.examProgram === "ap" ? { detail: d, essayScores: [], essayAi: false, isTestAccount: null, versions: [] } : null;
    },
  };
});

import AttemptHistoryTable from "./free-accounts/AttemptHistoryTable";
import ScoreStatsCard from "./free-accounts/ScoreStatsCard";
import { factsFromRpcRows } from "@/lib/free-accounts/facts";

let subjectId = "", ownSubject = false;
const students: Record<string, string> = {};
const cases: Record<string, string> = {}; // label -> attempt id
const created: string[] = [];

function mkStudent(label: string, memberType = "tutoring"): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', '${memberType}', 'admin_direct', '10th', now());`);
  students[label] = id; created.push(id);
  return id;
}
function mkStaff(label: string, role: "admin" | "consultant", tier?: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
  );
  psql(`insert into profiles (id, role, name${tier ? ", admin_tier" : ""}) values ('${id}', '${role}', '${RUN}-${label}'${tier ? `, '${tier}'` : ""});`);
  created.push(id); return id;
}
function addCandidate(name: string, kind: "mc" | "frq_bundle" = "mc") {
  const payload = kind === "mc" ? { stem: `Stem ${name}`, options: ["A1", "B2", "C3", "D4"], key_index: 1, explanation_en: "Because B2 is correct. Detailed English explanation.", stimulus: { kind: "none", description: "none" } } : { title: "FRQ", parts: [], stimulus: { kind: "none" } };
  psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, payload, review_state, render_verified, screen_verified, is_current)
        values (${q(K(name))}, ${q(RUN)}, '${subjectId}', ${q(AP_CODE)}, ${q(kind)}, '1.1', '1.A', ${q(kind === "frq_bundle" ? "frq_multipart" : "standalone")}, 'select', 'exact', ${json(payload)}, 'auto_passed', true, true, true);`);
}
function convert(name: string, frq = false): string {
  const pid = psql(`select ap_create_bank_problem(${q(K(name))}, 0, 'mock_exam', ${q(frq ? "essay" : "mc")}, '${ADMIN_ID}', 'medium', '1.1');`);
  const expl = "Because B2 is correct. Detailed English explanation.";
  const vid = psql(`select save_problem_draft_version(p_problem_id => '${pid}', p_passage => null, p_options => ${frq ? "null" : json(["A1", "B2", "C3", "D4"])}, p_correct_index => ${frq ? "null" : 1},
      p_explanation => '${expl}', p_difficulty => 'medium', p_actor_id => '${ADMIN_ID}', p_statements => ${frq ? json([{ label: "a", points: 2, prompt: "Explain the result.", mode: "explain" }, { label: "b", points: 2, prompt: "Compute.", mode: "numeric" }]) : "null"},
      p_question => ${q(`Stem ${name}`)}, p_explanation_en => '${expl}');`);
  psql(`select set_problem_render_check('${vid}', ${json({ ok: true, renderer: "std-1", issues: [] })});`);
  psql(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
  psql(`select ap_finalize_conversion(${q(K(name))}, '${ADMIN_ID}');`);
  return pid;
}
function mkSet(label: string, apLabel: "mc_practice" | "full_practice", sections: { key: string; kind: "mc" | "frq"; count: number }[]): string {
  const layout = { sections: sections.map((s) => ({ key: s.key, kind: s.kind, label: s.key, minutes: 30, count: s.count, calculator: "allowed", ...(s.kind === "mc" ? { options: 4 } : {}) })) };
  return psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, access_tier, exam_program, ap_subject, ap_label, section_layout)
    values (${q(`${RUN}-${label}`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'tutoring', 'ap', ${q(AP_CODE)}, ${q(apLabel)}, ${json(layout)}) returning id;`);
}
function addItem(setId: string, pid: string, section: string, pos: number): string {
  const vid = psql(`select published_version_id from problems where id = '${pid}'`);
  return psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${setId}', ${q(section)}, ${pos}, '${pid}', '${vid}', 'ap:1.1', 'medium') returning id;`);
}
const publish = (id: string) => psql(`update mock_exam_sets set status = 'published', published_at = now(), access_tier = 'tutoring' where id = '${id}';`);

let mcSet = "", fullSet = "", satSetId = "";
let mcItems: string[] = [];
const staff: Record<string, string> = {};
const out: Record<string, unknown> = { run: RUN };

beforeAll(() => {
  const existing = psql(`select id from subjects where ap_subject_code = ${q(AP_CODE)} limit 1;`);
  if (existing) subjectId = existing;
  else { subjectId = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN}-AP`)}, ${q(AP_CODE)}) returning id;`); ownSubject = true; }
  psql(`insert into subject_keywords (subject_id, label, normalized_label, content_code, level) select '${subjectId}', ${q(`${RUN} kw`)}, ${q(`${RUN} kw`)}, '1.1', 1 where not exists (select 1 from subject_keywords where subject_id = '${subjectId}' and content_code = '1.1' and level = 1);`);
  for (const n of ["m1", "m2", "m3"]) addCandidate(n);
  addCandidate("f1", "frq_bundle");
  const pids = ["m1", "m2", "m3"].map((n) => convert(n));
  const fpid = convert("f1", true);
  mcSet = mkSet("mc", "mc_practice", [{ key: "ap_mc", kind: "mc", count: 3 }]);
  mcItems = pids.map((p, i) => addItem(mcSet, p, "ap_mc", i + 1));
  publish(mcSet);
  fullSet = mkSet("full", "full_practice", [{ key: "ap_mc", kind: "mc", count: 2 }, { key: "ap_frq", kind: "frq", count: 1 }]);
  addItem(fullSet, pids[0], "ap_mc", 1); addItem(fullSet, pids[1], "ap_mc", 2); addItem(fullSet, fpid, "ap_frq", 1);
  publish(fullSet);

  // AP: 채점 완료(MC 3문항 중 1 정답·1 오답·1 무응답)
  const g = mkStudent("apgraded");
  cases.ap_graded = asUser(g, `select mock_exam_open_start('${mcSet}');`);
  asUser(g, `select mock_exam_ap_enter_section('${cases.ap_graded}', 'ap_mc');`);
  asUser(g, `select mock_exam_save_answer('${cases.ap_graded}', '${mcItems[0]}', '1', 5);`);
  asUser(g, `select mock_exam_save_answer('${cases.ap_graded}', '${mcItems[1]}', '0', 5);`);
  asUser(g, `select mock_exam_submit('${cases.ap_graded}');`);
  // AP: 진행 중, 응답 없음(Full Practice: MC 2 + FRQ 1)
  const p = mkStudent("apinprog");
  cases.ap_inprogress_noanswer = asUser(p, `select mock_exam_open_start('${fullSet}');`);
  asUser(p, `select mock_exam_ap_enter_section('${cases.ap_inprogress_noanswer}', 'ap_mc');`);
  // AP: 배정만 됨(시작 안 함)
  const a = mkStudent("apassigned");
  cases.ap_assigned = asUser(a, `select mock_exam_open_start('${mcSet}');`);
  // SAT: 채점 완료 MST + 진행 중
  const fx = createRoutingSet({ run: RUN, label: "acf" });
  satSetId = fx.setId;
  const s = mkStudent("satgraded");
  cases.sat_graded = assign(s, fx.setId); start(s, cases.sat_graded);
  answer(s, cases.sat_graded, fx.ids.rw_m1, 4); submitModule(s, cases.sat_graded, "rw_m1");
  answer(s, cases.sat_graded, fx.ids.rw_higher, 1); submitModule(s, cases.sat_graded, "rw_m2");
  submitModule(s, cases.sat_graded, "break");
  answer(s, cases.sat_graded, fx.ids.math_m1, 2); submitModule(s, cases.sat_graded, "math_m1");
  answer(s, cases.sat_graded, fx.ids.math_higher, 2); submitModule(s, cases.sat_graded, "math_m2");
  const si = mkStudent("satinprog");
  cases.sat_inprogress = assign(si, fx.setId); start(si, cases.sat_inprogress);
  // 권한 확인용 직원
  staff.master = mkStaff("master", "admin", "master");
  staff.full = mkStaff("full", "admin", "full");
  staff.supCap = mkStaff("supcap", "admin", "supervisor");
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${staff.supCap}', '학생관리');`);
  staff.supNoCap = mkStaff("supnocap", "admin", "supervisor");
  staff.consultant = mkStaff("consultant", "consultant");
}, 300_000);

afterAll(() => {
  try {
    psql(`begin; set local session_replication_role = replica;
      delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a where a.student_id = any(array['${created.join("','")}']::uuid[]));
      delete from mock_exam_attempts where student_id = any(array['${created.join("','")}']::uuid[]);
      delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%' or name like 'R3 acf %${RUN}%');
      delete from mock_exam_sets where name like '${RUN}-%' or name like 'R3 acf %${RUN}%';
      delete from supervisor_capabilities where profile_id = any(array['${created.join("','")}']::uuid[]);
      delete from students where id = any(array['${created.join("','")}']::uuid[]);
      delete from profiles where id = any(array['${created.join("','")}']::uuid[]);
      delete from auth.users where email like '${RUN}-%';
      commit;`);
  } catch { /* 격리 스택은 종료 시 통째로 폐기 */ }
  if (process.env.COMPAT_OUT) writeFileSync(process.env.COMPAT_OUT, JSON.stringify(out, null, 2));
});

const factsOf = (sid: string) => adminJson(`select coalesce(json_agg(f), '[]'::json)::text from admin_student_mock_attempt_facts('${sid}') f;`) as Record<string, unknown>[];

describe("RPC 응답 모양(640 적용 후)", () => {
  it("응시별 행: track/ap_subject/세트 문항 수", () => {
    const rows: Record<string, unknown> = {};
    for (const [label, sid] of Object.entries(students)) {
      rows[label] = factsOf(sid).map((r) => ({ track: r.exam_track, ap_subject: r.ap_subject, format: r.format, status: r.status, rw_total: r.rw_total, math_total: r.math_total, mc_total: r.mc_total, mc_correct: r.mc_correct, mc_item_count: r.mc_item_count, rw_answered: r.rw_answered, math_answered: r.math_answered }));
    }
    out.rpcRows = rows;
    expect((rows.apgraded as { track: string }[])[0].track).toBe("ap");
    expect((rows.satgraded as { track: string }[])[0].track).toBe("sat");
    if (process.env.COMPAT_EXPECT_ITEM_COUNT === "1") {
      const r = rows as Record<string, { mc_item_count: number | null; mc_total: number; mc_correct: number | null }[]>;
      expect(r.apgraded[0]).toMatchObject({ mc_item_count: 3, mc_total: 3, mc_correct: 1 });
      expect(r.apinprog[0]).toMatchObject({ mc_item_count: 2, mc_total: 0, mc_correct: null }); // FRQ 문항은 세지 않는다
      expect(r.apassigned[0]).toMatchObject({ mc_item_count: 3, mc_total: 0, mc_correct: null });
      expect(r.satgraded[0].mc_item_count).toBeNull();
      expect(r.satinprog[0].mc_item_count).toBeNull();
    }
  });
});

describe("권한 가드", () => {
  const call = (sid: string) => `select count(*) from admin_student_mock_attempt_facts('${sid}');`;
  it("학생·교사 아님·supervisor(권한 없음)·상담사는 42501, 관리자·master·full·supervisor+학생관리는 통과, 미인증은 거절", () => {
    const target = students.apgraded;
    const res: Record<string, string> = {};
    const tryAs = (uid: string) => { const e = fails(() => asUser(uid, call(target))); return e ? (e.includes("42501") || e.includes("not_allowed") ? "42501 not_allowed" : e.slice(0, 120)) : "ok"; };
    res.student_self = tryAs(target);
    res.other_student = tryAs(students.satgraded);
    res.consultant = tryAs(staff.consultant);
    res.supervisor_no_cap = tryAs(staff.supNoCap);
    res.seed_admin = tryAs(ADMIN_ID); res.master = tryAs(staff.master); res.full = tryAs(staff.full); res.supervisor_cap = tryAs(staff.supCap);
    const anonE = fails(() => psql(`set role anon; ${call(target)} reset role;`));
    res.anon = anonE ? anonE.replace(/\s+/g, " ").slice(0, 140) : "ok";
    const noSub = fails(() => psql(`set role authenticated; ${call(target)} reset role;`));
    res.authenticated_no_jwt_sub = noSub ? (noSub.includes("not_allowed") ? "42501 not_allowed" : noSub.replace(/\s+/g, " ").slice(0, 140)) : "ok";
    out.guard = res;
    for (const k of ["student_self", "other_student", "consultant", "supervisor_no_cap"]) expect(res[k]).toBe("42501 not_allowed");
    for (const k of ["seed_admin", "master", "full", "supervisor_cap"]) expect(res[k]).toBe("ok");
    expect(res.anon).toMatch(/permission denied/);
    expect(res.authenticated_no_jwt_sub).toBe("42501 not_allowed");
  });
});

describe("코드 조합(이 파일이 놓인 체크아웃의 컴포넌트)", () => {
  it("목록·요약·상세 진입 경로 — SAT/AP 응시별 동작", async () => {
    const all = Object.values(students).flatMap((sid) => factsOf(sid));
    const rows = factsFromRpcRows(all as never);
    const result: Record<string, unknown> = {};
    // 요약 카드
    try {
      const v = render(createElement(ScoreStatsCard, { facts: rows }));
      result.summaryCard = { ok: true, text: v.container.textContent?.replace(/\s+/g, " ").slice(0, 600) };
      v.unmount();
    } catch (e) { result.summaryCard = { ok: false, error: String(e).slice(0, 200) }; }
    // 목록 + 상세 진입
    const labelOf = Object.fromEntries(Object.entries(cases).map(([l, id]) => [id, l]));
    const perAttempt: Record<string, unknown> = {};
    for (const r of rows) {
      const label = labelOf[r.attemptId];
      if (!label) continue;
      const entry: Record<string, unknown> = { track: r.track, status: r.status };
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const v = render(createElement(AttemptHistoryTable, { rows: [r] }));
        const tr = v.container.querySelector("tbody tr");
        entry.listRow = tr?.textContent?.replace(/\s+/g, " ").trim();
        const btn = [...v.container.querySelectorAll("button")].find((b) => b.textContent === "View result");
        entry.hasViewButton = !!btn;
        if (btn) {
          try {
            fireEvent.click(btn);
            await waitFor(() => { if (v.container.querySelector("[aria-busy=true]")) throw new Error("loading"); }, { timeout: 8000 });
            const panel = v.container.querySelector("div.border-t");
            entry.detailRendered = true;
            entry.apResultView = !!v.container.querySelector("[data-testid=admin-ap-result]");
            entry.detailText = panel?.textContent?.replace(/\s+/g, " ").trim().slice(0, 260);
          } catch (e) { entry.detailCrash = String(e instanceof Error ? e.message : e).slice(0, 300); }
        }
        v.unmount();
      } catch (e) { entry.renderCrash = String(e instanceof Error ? e.message : e).slice(0, 300); }
      errSpy.mockRestore(); cleanup();
      perAttempt[label] = entry;
    }
    result.perAttempt = perAttempt;
    out.components = result;
    expect(Object.keys(perAttempt).length).toBe(Object.keys(cases).length);
  }, 120_000);
});

void randomUUID; void ownSubject; void satSetId; void expect;
