import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 모의고사 문항 풀 + 세트 배정 RPC `mock_exam_pool_usage`(2026-09-29). 다른 데이터와 섞이지 않도록 실행 ID(RUN)가 붙은
// 전용 문제·세트만 만들고, 결과는 (RPC 전/후 차이)로 검증한다. afterAll 에서 만든 행만 정리한다. 재실행 안전.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `${Date.now()}`;
const DOMAIN = "rw_craft_structure";
const SKILL = "words_in_context";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
const alpha = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)).repeat(3));
let seq = 0;
const problems: string[] = [];
const sets: string[] = [];

function problem(scope: string, opts: { archived?: boolean; unpublished?: boolean } = {}): string {
  seq += 1;
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by, usage_scope, sat_domain, skill_code)
     values ('mc', 'Pool ${RUN} ${alpha(seq)} passage', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', '${scope}', '${DOMAIN}', '${SKILL}') returning id;`,
  );
  problems.push(id);
  if (!opts.unpublished) {
    psql(`update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`);
    const v = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
    psql(`update problems set published_version_id = '${v}' where id = '${id}';`);
  }
  else psql(`update problem_versions set status = 'draft', published_at = null where problem_id = '${id}';`);
  if (opts.archived) psql(`update problems set archived_at = now() where id = '${id}';`);
  return id;
}
function set(status: "draft" | "published" | "archived"): string {
  const id = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, created_by, archived_at, published_at)
     values ('Pool ${RUN} ${status}', 'standard', '${status}', '${ADMIN_ID}', ${status === "archived" ? "now()" : "null"}, ${status === "published" ? "now()" : "null"}) returning id;`,
  );
  sets.push(id);
  return id;
}
let pos = 0;
function place(setId: string, problemId: string) {
  pos += 1;
  psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty)
        select '${setId}', 'rw', ${pos}, id, published_version_id, '${DOMAIN}', '${SKILL}', 'medium' from problems where id = '${problemId}';`);
}

type Cell = { published: number; assigned_published: number; assigned_draft: number };
function cells(): Record<string, Cell> {
  const out = psql(`select usage_scope, published, assigned_published, assigned_draft from mock_exam_pool_usage() where sat_domain = '${DOMAIN}' and skill_code = '${SKILL}';`);
  const map: Record<string, Cell> = {};
  for (const line of out.split("\n").filter(Boolean)) {
    const [scope, p, ap, ad] = line.split("|");
    map[scope] = { published: Number(p), assigned_published: Number(ap), assigned_draft: Number(ad) };
  }
  return map;
}
const zero: Cell = { published: 0, assigned_published: 0, assigned_draft: 0 };

afterAll(() => {
  const ids = problems.map((i) => `'${i}'`).join(",") || "null";
  const s = sets.map((i) => `'${i}'`).join(",") || "null";
  psql(`delete from mock_exam_set_items where exam_set_id in (${s}) or problem_id in (${ids});`);
  psql(`delete from mock_exam_sets where id in (${s});`);
  psql(`update problems set published_version_id = null where id in (${ids});`);
  psql(`delete from problem_versions where problem_id in (${ids});`);
  psql(`delete from problems where id in (${ids});`);
});

let before: Record<string, Cell>;
beforeAll(() => { before = cells(); });

describe("mock_exam_pool_usage", () => {
  it("공개 세트·초안 세트 배정을 서로 다른 문항 수로 세고, 보관·비공개 문항·보관 세트는 제외한다", () => {
    const pub = set("published");
    const draft = set("draft");
    const arch = set("archived");
    const both = problem("mock_exam"); // 공개+초안 세트 둘 다 → 공개로만 1
    const draftOnly = problem("mock_exam");
    const free = problem("mock_exam"); // 미배정
    const legacy = problem("both"); // 기존(양쪽), 초안에만
    const archivedProblem = problem("mock_exam", { archived: true }); // 풀 제외
    problem("mock_exam", { unpublished: true }); // 공개 아님 → 풀 제외
    const inArchivedSet = problem("mock_exam"); // 보관 세트에만 → 배정 아님
    place(pub, both);
    place(draft, both);
    place(draft, draftOnly);
    place(draft, legacy);
    place(draft, archivedProblem);
    place(arch, inArchivedSet);
    expect(free).toBeTruthy();

    const after = cells();
    const d = (scope: string, k: keyof Cell) => (after[scope]?.[k] ?? 0) - (before[scope]?.[k] ?? zero[k]);
    expect(d("mock_exam", "published")).toBe(4); // both, draftOnly, free, inArchivedSet
    expect(d("mock_exam", "assigned_published")).toBe(1);
    expect(d("mock_exam", "assigned_draft")).toBe(1);
    expect(d("both", "published")).toBe(1);
    expect(d("both", "assigned_published")).toBe(0);
    expect(d("both", "assigned_draft")).toBe(1);
  });

  it("service_role 만 실행할 수 있다", () => {
    expect(psql(`select has_function_privilege('anon', 'public.mock_exam_pool_usage()', 'execute')::text || has_function_privilege('authenticated', 'public.mock_exam_pool_usage()', 'execute')::text || has_function_privilege('service_role', 'public.mock_exam_pool_usage()', 'execute')::text;`)).toBe("falsefalsetrue");
  });
});
