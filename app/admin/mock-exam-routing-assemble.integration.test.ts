import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll } from "vitest";

// MST Phase 3 — 관리자 조립이 M2 higher/lower 두 변형을 만들고 readiness 가 변형별로 검증하는지(실제 로컬 DB).
// 풀은 부족분만 벌크로 보강한다(재실행해도 풀이 계속 커지지 않는다). 단언은 이 테스트가 만든 세트로 한정한다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421", SERVICE_ROLE_KEY);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

let adminUserId: string;
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ supabase: admin, adminUserId }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const RW_DOMAINS = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];
const MATH_DOMAINS = ["algebra", "advanced_math", "problem_solving_data", "geometry_trig"];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** (영역, 난이도, 형식) 셀마다 서로 다른 유사문항 그룹의 후보가 target 개 미만이면 모자란 만큼만 벌크 insert. 본문은 숫자를 글자로 바꾼 랜덤 문자열(자동 유사문항 그룹 방지). */
function topUp(domain: string, difficulty: string, format: "mc" | "spr", target: number) {
  const have = Number(
    psql(
      `select count(distinct coalesce(p.similarity_group, p.id::text)) from problems p join problem_versions v on v.problem_id = p.id and v.status = 'published'
       where p.sat_domain = '${domain}' and p.status = 'confirmed' and p.archived_at is null and p.usage_scope in ('mock_exam','both')
         and p.format = '${format}' and lower(v.difficulty) = '${difficulty}'
         and (v.render_check->>'ok')::boolean is true and coalesce(btrim(v.explanation_en), '') <> '';`,
    ),
  );
  const need = target - have;
  if (need <= 0) return;
  const cols = format === "mc" ? "options, correct_index, " : "";
  const vals = format === "mc" ? `'["A","B","C","D"]'::jsonb, 0, ` : "";
  psql(
    `insert into problems (format, passage, ${cols}explanation, status, difficulty, skill_code, created_by)
     select '${format}', 'R3A ' || translate(md5(random()::text || g::text), '0123456789', 'ghijklmnop') || translate(md5(clock_timestamp()::text || g::text), '0123456789', 'qrstuvwxyz'),
            ${vals}'because', 'confirmed', '${difficulty}',
            (select code from problem_skill_codes where domain = '${domain}' order by code offset (g % (select count(*) from problem_skill_codes where domain = '${domain}')) limit 1),
            '${adminUserId}'
     from generate_series(1, ${need}) g;`,
  );
  if (format === "spr") {
    psql(`update problem_versions v set answers = '["5"]'::jsonb from problems p where p.id = v.problem_id and p.format = 'spr' and v.answers is null and p.passage like 'R3A %';`);
  }
  psql(`update problem_versions v set render_check = '{"ok": true, "issues": []}'::jsonb, explanation_en = 'Because.' from problems p where p.id = v.problem_id and p.passage like 'R3A %' and v.render_check is null;`);
}

describe("MST 라우팅 조립 (실제 로컬 DB)", () => {
  beforeAll(async () => {
    const email = `r3-assemble-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: "test-password-12345", email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "admin 생성 실패");
    adminUserId = data.user.id;
    psql(`insert into profiles (id, role, name) values ('${adminUserId}', 'admin', 'r3-assemble-admin');`);
    for (const domain of RW_DOMAINS) for (const d of DIFFICULTIES) topUp(domain, d, "mc", 24);
    for (const domain of MATH_DOMAINS)
      for (const d of DIFFICULTIES) {
        topUp(domain, d, "mc", 28);
        topUp(domain, d, "spr", 10);
      }
  }, 240_000);

  it("routing 기본 ON: M2 를 lower·higher 두 변형(정원 27/22)으로 만들고 세트 내 문항 중복 0, 난이도 배정 규칙 준수, ready", async () => {
    const { assembleMockExamSet } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({ name: `R3 라우팅 세트 ${Date.now()}`, difficultyTier: "standard", rwCount: 0, mathCount: 0, format: "mst" });
    expect(result.shortfalls).toEqual([]);
    expect(result.readiness?.ready).toBe(true);
    expect(result.readiness?.routing).toBe(true);
    expect(result.readiness?.variantEligibilityViolations).toEqual([]);
    expect(result.readiness?.routingPolicyMissing).toEqual([]);
    expect(psql(`select assembly_rules->>'routing' from mock_exam_sets where id = '${result.examSetId}';`)).toBe("true");

    const q = (sql: string) => psql(`select ${sql} from mock_exam_set_items where exam_set_id = '${result.examSetId}'`);
    const count = (key: string, route: string | null) =>
      Number(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${result.examSetId}' and module_key = '${key}' and route ${route ? `= '${route}'` : "is null"};`));
    expect(count("rw_m1", null)).toBe(27);
    expect(count("rw_m2", "lower")).toBe(27);
    expect(count("rw_m2", "higher")).toBe(27);
    expect(count("math_m1", null)).toBe(22);
    expect(count("math_m2", "lower")).toBe(22);
    expect(count("math_m2", "higher")).toBe(22);
    expect(count("rw_m2", null)).toBe(0);
    // 147 = 27*3 + 22*3 문항, 전부 서로 다른 문제(모듈 간·변형 간 중복 0)
    expect(q(`count(*) || '|' || count(distinct problem_id)`)).toBe("147|147");
    // 배정 가능 플래그: M1·lower = easy/medium, higher = medium/hard
    expect(q(`count(*) filter (where module_key in ('rw_m1','math_m1') and not m1_eligible)`)).toBe("0");
    expect(q(`count(*) filter (where route = 'lower' and not m2_lower_eligible)`)).toBe("0");
    expect(q(`count(*) filter (where route = 'higher' and not m2_higher_eligible)`)).toBe("0");
    expect(q(`count(*) filter (where route = 'higher' and difficulty = 'easy')`)).toBe("0");
    expect(q(`count(*) filter (where route = 'lower' and difficulty = 'hard')`)).toBe("0");
    expect(Number(q(`count(*) filter (where route = 'higher' and difficulty = 'hard')`))).toBeGreaterThan(0);
    // 스냅샷 전량, 섹션 내 position 연속(rw 1..81, math 1..66)
    expect(q(`count(*) filter (where content_snapshot is null)`)).toBe("0");
    expect(q(`max(position) filter (where section = 'rw') || '|' || max(position) filter (where section = 'math')`)).toBe("81|66");
    expect(result.readiness?.modules.filter((m) => m.moduleKey === "rw_m2").map((m) => m.route).sort()).toEqual(["higher", "lower"]);
  }, 240_000);

  it("routing=false 는 레거시 4모듈(route 문항 없음, assembly_rules 에 routing 없음)", async () => {
    const { assembleMockExamSet } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({ name: `R3 레거시 세트 ${Date.now()}`, difficultyTier: "standard", rwCount: 0, mathCount: 0, format: "mst", routing: false });
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${result.examSetId}' and route is not null;`)).toBe("0");
    expect(psql(`select coalesce(assembly_rules->>'routing', 'absent') from mock_exam_sets where id = '${result.examSetId}';`)).toBe("absent");
    expect(result.readiness?.routing).toBe(false);
  }, 240_000);

  it("관리자 화면 데이터: 활성 정책 목록과 내역의 경로·정책 버전 컬럼", async () => {
    const { listMockExamRoutingPoliciesAction, listAllMockExamAttemptsAction } = await import("./mock-exam-actions");
    const policies = await listMockExamRoutingPoliciesAction();
    expect(policies.filter((p) => p.active).map((p) => p.section).sort()).toEqual(["math", "rw"]);
    expect(policies.find((p) => p.section === "rw" && p.version === 1)).toMatchObject({ thresholdType: "correct_ratio", thresholdValue: 0.65 });
    const history = await listAllMockExamAttemptsAction();
    expect(history[0]).toHaveProperty("rwRoute");
    expect(history[0]).toHaveProperty("mathPolicyVersion");
  });
});
