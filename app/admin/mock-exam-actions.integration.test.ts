import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll } from "vitest";

// 고정형 SAT 모의고사 V1 — 관리자 조립·공개 액션(app/admin/mock-exam-actions.ts)을
// 실제 로컬 Postgres/Supabase(로컬 supabase start 인스턴스)에 대고 검증한다.
// requireAdmin()은 next/headers 쿠키가 필요해 vitest 환경에서 그대로 못 쓰므로
// 다른 통합 테스트(app/admin/confirm-student-teacher-subject-match.integration.test.ts)와
// 같은 패턴으로 admin-auth만 목으로 대체하고, DB는 실제 로컬 인스턴스를 그대로 쓴다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

let adminUserId: string;

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({ supabase: admin, adminUserId }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => admin,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const RW_DOMAINS = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];
const MATH_DOMAINS = ["algebra", "advanced_math", "problem_solving_data", "geometry_trig"];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

async function seedConfirmedProblem(domain: string, difficulty: (typeof DIFFICULTIES)[number], label: string) {
  // problems 에 status='confirmed'로 바로 넣으면 트리거(problems_create_initial_version,
  // 20261293000000)가 1번 버전을 자동으로 만들고 즉시 published 로 올린다 — 별도 버전
  // insert가 필요 없다(오히려 중복 unique 제약 위반이 난다).
  const skillCode = psql(`select code from problem_skill_codes where domain = '${domain}' limit 1;`);
  const problemId = psql(`
    insert into problems (format, passage, options, correct_index, explanation, status, difficulty, skill_code, created_by)
    values ('mc', '${label} passage', '["A","B","C","D"]'::jsonb, 0, 'because', 'confirmed', '${difficulty}', '${skillCode}', '${adminUserId}')
    returning id;
  `);
  return { problemId };
}

describe("mock-exam-actions (조립·공개, 실제 로컬 DB)", () => {
  beforeAll(async () => {
    const email = `p7-mock-exam-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: "test-password-12345", email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "admin 생성 실패");
    adminUserId = data.user.id;
    psql(`insert into profiles (id, role, name) values ('${adminUserId}', 'admin', 'mock-exam-test-admin');`);

    // 각 R&W/Math 영역 x 난이도 조합으로 넉넉히 문제를 심어 목표 셀을 채울 수 있게 한다.
    for (const domain of [...RW_DOMAINS, ...MATH_DOMAINS]) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 3; i++) {
          await seedConfirmedProblem(domain, difficulty, `${domain}-${difficulty}-${i}`);
        }
      }
    }
  });

  it("영역·난이도 비중대로 세트를 조립하고 부족분 없이 채운다", async () => {
    const { assembleMockExamSet, getMockExamSetItems } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({
      name: `표준 세트 ${Date.now()}`,
      difficultyTier: "standard",
      rwCount: 20,
      mathCount: 16,
    });
    expect(result.shortfalls).toEqual([]);

    const items = await getMockExamSetItems(result.examSetId);
    expect(items.filter((i) => i.section === "rw")).toHaveLength(20);
    expect(items.filter((i) => i.section === "math")).toHaveLength(16);

    // 세트 안 중복 문항 없음
    const problemIds = items.map((i) => i.problemId);
    expect(new Set(problemIds).size).toBe(problemIds.length);

    // 난이도 비중(표준: easy 25 / medium 50 / hard 25)이 대략 지켜지는지 확인 — medium이 가장 많아야 한다.
    const rwByDifficulty = items.filter((i) => i.section === "rw").reduce<Record<string, number>>((acc, i) => {
      acc[i.difficulty] = (acc[i.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    expect(rwByDifficulty.medium).toBeGreaterThan(rwByDifficulty.easy ?? 0);
    expect(rwByDifficulty.medium).toBeGreaterThan(rwByDifficulty.hard ?? 0);
  });

  it("draft 세트를 공개하면 status가 published로 바뀐다", async () => {
    const { assembleMockExamSet, publishMockExamSet, listMockExamSets } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({
      name: `공개 테스트 세트 ${Date.now()}`,
      difficultyTier: "foundation",
      rwCount: 5,
      mathCount: 5,
    });
    await publishMockExamSet(result.examSetId);
    const sets = await listMockExamSets();
    const published = sets.find((s) => s.id === result.examSetId);
    expect(published?.status).toBe("published");
  });

  it("같은 계열에 새 버전을 공개하면 이전 공개본은 archived로 내려간다(공개는 계열당 하나)", async () => {
    const { assembleMockExamSet, publishMockExamSet, listMockExamSets } = await import("./mock-exam-actions");
    const groupName = `버전 교체 세트 ${Date.now()}`;
    const first = await assembleMockExamSet({ name: groupName, difficultyTier: "advanced", rwCount: 5, mathCount: 5 });
    await publishMockExamSet(first.examSetId);

    // 같은 set_group_id로 새 버전 행을 만든 뒤(관리자 "새 버전 만들기" 흐름의 단순화 — 실제로는
    // 전용 액션이 별도로 필요하지만 이 테스트는 DB 제약(공개는 계열당 하나)만 검증한다) 공개한다.
    const groupId = psql(`select set_group_id from mock_exam_sets where id = '${first.examSetId}';`);
    const secondSetId = psql(`
      insert into mock_exam_sets (set_group_id, version_no, name, difficulty_tier, status, created_by)
      values ('${groupId}', 2, '${groupName}', 'advanced', 'draft', '${adminUserId}')
      returning id;
    `);
    // 두 번째 버전에도 문항을 채워야 publishMockExamSet이 "문항 없는 세트" 오류를 던지지 않는다.
    const firstItems = await (await import("./mock-exam-actions")).getMockExamSetItems(first.examSetId);
    for (const item of firstItems) {
      psql(`
        insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty)
        select '${secondSetId}', section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty
        from mock_exam_set_items where id = '${item.id}';
      `);
    }

    await publishMockExamSet(secondSetId);
    const sets = await listMockExamSets();
    const firstAfter = sets.find((s) => s.id === first.examSetId);
    const secondAfter = sets.find((s) => s.id === secondSetId);
    expect(firstAfter).toBeUndefined(); // archived_at is null 조건으로 목록에서 빠진다
    expect(secondAfter?.status).toBe("published");
  });
});
