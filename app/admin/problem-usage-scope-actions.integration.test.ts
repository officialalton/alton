import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 문제 용도(2026-09-29) — 서버 액션 계약. 실제 로컬 Supabase 에 대해, requireAdmin 만 목으로 대체한다
// (다른 admin 통합 테스트와 같은 패턴). 이 파일이 만든 행(전용 관리자 created_by)만 정리한다. AI 호출 없음
// (계산형 컴파일러 경로만 쓴다).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const admin = createClient(process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421", SERVICE_ROLE_KEY);
const RUN = `${Date.now()}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
let adminUserId: string;
const createdSets: string[] = [];

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ supabase: admin, adminUserId }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const alpha = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)).repeat(2));
let seq = 0;

function seedProblem(domain: string, difficulty: string, scope: string, skill: string): string {
  seq += 1;
  const id = psql(`
    insert into problems (format, passage, options, correct_index, explanation, status, difficulty, skill_code, created_by, usage_scope)
    values ('mc', 'Scope ${RUN} ${alpha(seq)} ${domain} ${difficulty} ${scope} passage', '["A","B","C","D"]'::jsonb, 0, 'because', 'confirmed', '${difficulty}', '${skill}', '${adminUserId}', '${scope}')
    returning id;`);
  psql(`update problem_versions set render_check = '{"ok": true, "issues": []}'::jsonb, explanation_en = 'Because.' where problem_id = '${id}';`);
  return id;
}

beforeAll(async () => {
  const email = `usage-scope-admin-${RUN}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: "test-password-12345", email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "admin 생성 실패");
  adminUserId = data.user.id;
  psql(`insert into profiles (id, role, name) values ('${adminUserId}', 'admin', 'usage-scope-admin');`);
}, 30_000);

afterAll(() => {
  const sets = createdSets.map((s) => `'${s}'`).join(",") || "null";
  psql(`delete from mock_exam_set_items where exam_set_id in (${sets});`);
  psql(`delete from mock_exam_sets where id in (${sets});`);
  const ids = `select id from problems where created_by = '${adminUserId}'`;
  psql(`update problems set published_version_id = null where id in (${ids});`);
  psql(`delete from problem_versions where problem_id in (${ids});`);
  psql(`delete from problem_keywords where problem_id in (${ids});`);
  psql(`delete from problems where created_by = '${adminUserId}';`);
});

describe("생성 액션은 용도를 요구한다", () => {
  it("createBankProblemAction: 용도 없음·both 거절, 지정하면 저장", async () => {
    const { createBankProblemAction } = await import("./problem-bank-actions");
    const base = { subjectId: SUBJECT_ID, format: "mc", skillCode: "words_in_context", examSystem: "sat_rw", difficulty: "medium" };
    const none = await createBankProblemAction({ ...base } as never);
    expect(none.ok).toBe(false);
    const both = await createBankProblemAction({ ...base, usageScope: "both" } as never);
    expect(both.ok).toBe(false);
    const ok = await createBankProblemAction({ ...base, usageScope: "mock_exam" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(psql(`select usage_scope from problems where id = '${ok.value}';`)).toBe("mock_exam");
  });

  it("generateBankProblemsAction: 용도 없으면 아무것도 만들지 않고, 계산형 배치는 모든 문항에 같은 용도·컴파일러 그룹을 붙인다", async () => {
    const { generateBankProblemsAction } = await import("./problem-bank-actions");
    const params = { subjectId: SUBJECT_ID, skillType: "Circles", skillCode: "circles", difficulty: "medium", format: "mc", count: 3, examSystem: "sat_math" };
    const before = psql(`select count(*) from problems where created_by = '${adminUserId}';`);
    const rejected = await generateBankProblemsAction({ ...params } as never);
    expect(rejected.ok).toBe(false);
    expect(psql(`select count(*) from problems where created_by = '${adminUserId}';`)).toBe(before);

    const res = await generateBankProblemsAction({ ...params, usageScope: "general" });
    expect(res.ok).toBe(true);
    const rows = psql(
      `select usage_scope || '|' || created_via || '|' || coalesce(subpattern, '-') || '|' || coalesce(similarity_group, '-') from problems where created_by = '${adminUserId}' and created_via = 'compiler';`,
    ).split("\n");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const [scope, via, sub, grp] = r.split("|");
      expect(scope).toBe("general");
      expect(via).toBe("compiler");
      expect(sub).not.toBe("-");
      expect(grp).toBe(`c:circles:${sub}`);
    }
  }, 60_000);
});

describe("재분류·그룹 액션", () => {
  it("선택 재분류·필터 재분류·개수 불일치 거절·both 거절", async () => {
    const { retagProblemsUsageScopeAction, countRetagCandidatesAction } = await import("./problem-bank-actions");
    const legacy = [1, 2, 3].map(() => {
      const id = seedProblem("algebra", "medium", "both", "linear_equations_one_var");
      return id;
    });
    const reject = await retagProblemsUsageScopeAction({ problemIds: legacy, scope: "both" as never });
    expect(reject.ok).toBe(false);

    const changed = await retagProblemsUsageScopeAction({ problemIds: [legacy[0]], scope: "general", expectedCount: 1, reason: `t ${RUN}` });
    expect(changed).toEqual({ ok: true, value: { changed: 1 } });

    const counted = await countRetagCandidatesAction({ skillCode: "linear_equations_one_var" });
    expect(counted.ok).toBe(true);
    if (!counted.ok) return;
    const mine = legacy.slice(1);
    for (const id of mine) expect(counted.value.ids).toContain(id);
    expect(counted.value.ids).not.toContain(legacy[0]);

    // 확인창의 개수와 다르면 실행하지 않는다.
    const stale = await retagProblemsUsageScopeAction({ filter: { skillCode: "linear_equations_one_var", onlyLegacy: true }, scope: "mock_exam", expectedCount: counted.value.count + 5 });
    expect(stale.ok).toBe(false);
    expect(psql(`select usage_scope from problems where id = '${mine[0]}';`)).toBe("both");

    // 필터 결과 전체 재분류 — 이 필터에는 다른 legacy 문제도 있을 수 있어 개수 대조로 실행하고 내 행만 확인한다.
    const all = await retagProblemsUsageScopeAction({ filter: { skillCode: "linear_equations_one_var", onlyLegacy: true }, scope: "mock_exam", expectedCount: counted.value.count });
    expect(all.ok).toBe(true);
    for (const id of mine) expect(psql(`select usage_scope from problems where id = '${id}';`)).toBe("mock_exam");
    expect(psql(`select count(*) from problem_usage_scope_changes where problem_id = '${mine[0]}' and changed_by = '${adminUserId}';`)).toBe("1");
  }, 30_000);

  it("setProblemSimilarityGroupAction: 지정하면 잠기고, 비우면 자동 값으로 돌아간다", async () => {
    const { setProblemSimilarityGroupAction } = await import("./problem-bank-actions");
    const id = seedProblem("algebra", "medium", "mock_exam", "linear_equations_one_var");
    const auto = psql(`select similarity_group from problems where id = '${id}';`);
    expect(auto).toMatch(/^t:linear_equations_one_var:/);
    const set = await setProblemSimilarityGroupAction(id, ` custom-${RUN} `);
    expect(set).toEqual({ ok: true, value: { group: `custom-${RUN}` } });
    const cleared = await setProblemSimilarityGroupAction(id, null);
    expect(cleared).toEqual({ ok: true, value: { group: auto } });
  });
});

describe("조립은 모의고사용·기존만 쓴다", () => {
  it("일반용 문항을 많이 심어도 조립 결과에 들어오지 않고, 풀 요약은 용도별로 센다", async () => {
    const { assembleMockExamSet, getMockExamSetItems, getMockExamPoolSummaryAction } = await import("./mock-exam-actions");
    const domains = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english", "algebra", "advanced_math", "problem_solving_data", "geometry_trig"];
    const generalIds: string[] = [];
    for (const domain of domains) {
      const skill = psql(`select code from problem_skill_codes where domain = '${domain}' order by code limit 1;`);
      for (const difficulty of ["easy", "medium", "hard"]) {
        for (let i = 0; i < 4; i++) generalIds.push(seedProblem(domain, difficulty, "general", skill));
        for (let i = 0; i < 2; i++) seedProblem(domain, difficulty, "mock_exam", skill);
      }
    }
    const result = await assembleMockExamSet({ name: `용도 조립 ${RUN}`, difficultyTier: "standard", rwCount: 12, mathCount: 12 });
    createdSets.push(result.examSetId);
    const items = await getMockExamSetItems(result.examSetId);
    expect(items.length).toBeGreaterThan(0);
    const used = items.map((i) => i.problemId);
    const scopes = psql(`select distinct usage_scope from problems where id in (${used.map((u) => `'${u}'`).join(",")});`).split("\n");
    expect(scopes.every((s) => s === "mock_exam" || s === "both")).toBe(true);
    for (const g of generalIds) expect(used).not.toContain(g);

    const pool = await getMockExamPoolSummaryAction();
    const cell = pool.find((r) => r.satDomain === "algebra");
    expect(cell).toBeTruthy();
    expect(pool.reduce((a, r) => a + r.general, 0)).toBeGreaterThanOrEqual(generalIds.length);
  }, 90_000);
});
