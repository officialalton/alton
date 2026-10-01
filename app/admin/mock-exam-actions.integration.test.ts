import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll } from "vitest";

// 고정형 SAT 모의고사 V1 — 관리자 조립·공개 액션(app/admin/mock-exam-actions.ts)을
// 실제 로컬 Postgres/Supabase(로컬 supabase start 인스턴스)에 대고 검증한다.
// requireAdmin()은 next/headers 쿠키가 필요해 vitest 환경에서 그대로 못 쓰므로
// 다른 통합 테스트(app/admin/confirm-student-teacher-subject-match.integration.test.ts)와
// 같은 패턴으로 admin-auth만 목으로 대체하고, DB는 실제 로컬 인스턴스를 그대로 쓴다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421", SERVICE_ROLE_KEY);

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

let seedSkillCounter = 0;
// 자동 유사문항 그룹(2026-09-29)은 숫자를 지운 본문으로 계산한다 — 숫자만 다른 픽스처가 한 그룹으로 묶이지 않게 글자를 섞는다.
const alphaOf = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)).repeat(2));

async function seedConfirmedProblem(
  domain: string,
  difficulty: (typeof DIFFICULTIES)[number],
  label: string,
  format: "mc" | "spr" = "mc",
) {
  // problems 에 status='confirmed'로 바로 넣으면 트리거(problems_create_initial_version,
  // 20261293000000)가 1번 버전을 자동으로 만들고 즉시 published 로 올린다 — 별도 버전
  // insert가 필요 없다(오히려 중복 unique 제약 위반이 난다).
  // Phase 2(skill 균형 검증): 영역의 skill 코드를 돌려가며 배정해 한 skill 쏠림 없이 풀을 만든다.
  seedSkillCounter += 1;
  const skillCode = psql(
    `select code from problem_skill_codes where domain = '${domain}' order by code offset (${seedSkillCounter} % (select count(*) from problem_skill_codes where domain = '${domain}')) limit 1;`,
  );
  if (format === "mc") {
    const problemId = psql(`
      insert into problems (format, passage, options, correct_index, explanation, status, difficulty, skill_code, created_by)
      values ('mc', '${label} ${alphaOf(seedSkillCounter)} passage', '["A","B","C","D"]'::jsonb, 0, 'because', 'confirmed', '${difficulty}', '${skillCode}', '${adminUserId}')
      returning id;
    `);
    return { problemId };
  }
  // SPR은 problems 테이블에 answers 컬럼이 없다(problem_versions에만 있음) — 트리거가 만든
  // 1번 버전에 별도로 채워 넣는다(lib/mock-exam/mock-exam-attempt-flow.integration.test.ts의
  // publishedProblem 헬퍼와 같은 패턴).
  const problemId = psql(`
    insert into problems (format, passage, explanation, status, difficulty, skill_code, created_by)
    values ('spr', '${label} ${alphaOf(seedSkillCounter)} passage', 'because', 'confirmed', '${difficulty}', '${skillCode}', '${adminUserId}')
    returning id;
  `);
  psql(`update problem_versions set answers = '["5"]'::jsonb where problem_id = '${problemId}' and version_no = 1;`);
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
    // Math는 형식(mc/spr) 비중도 걸리므로(2026-09-21 UAT 지적) spr 후보도 셀을 채울 만큼 심는다.
    for (const domain of MATH_DOMAINS) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 3; i++) {
          await seedConfirmedProblem(domain, difficulty, `${domain}-${difficulty}-spr-${i}`, "spr");
        }
      }
    }
    // 2026-09-28: 문제 108개를 psql로 하나씩 심느라 8~13초가 걸려 기본 hookTimeout(10초)에
    // 간헐적으로 걸렸다(다른 통합 테스트와 동시 실행 시). 시딩 로직은 그대로 두고 시간만 늘린다.
  }, 60_000);

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

  it("Math 섹션은 객관식만이 아니라 SPR도 섞어서 채운다(2026-09-21 UAT: 형식 비중 누락 수정)", async () => {
    const { assembleMockExamSet } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({
      name: `형식 비중 세트 ${Date.now()}`,
      difficultyTier: "standard",
      rwCount: 10,
      mathCount: 20,
    });
    const formats = psql(`
      select p.format from mock_exam_set_items i join problems p on p.id = i.problem_id
      where i.exam_set_id = '${result.examSetId}' and i.section = 'math';
    `).split("\n");
    expect(formats).toContain("mc");
    expect(formats).toContain("spr");
  });

  // MST는 모듈마다 정원(27/27/22/22)을 영역×난이도(×형식) 셀로 채우고 M2는 M1이 쓴 문항을 제외하므로,
  // beforeAll의 셀당 3문항 풀로는 M1조차 못 채운다(fallback 없음 — 의도된 동작). 두 MST 테스트가 새 DB에서도
  // 결정적으로 돌도록 셀당 넉넉히 보강한다(R&W mc 6, Math mc 6 + spr 3 추가).
  async function seedMstPool(tag: string) {
    for (const domain of RW_DOMAINS) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 6; i++) await seedConfirmedProblem(domain, difficulty, `${domain}-${difficulty}-${tag}-${i}`);
      }
    }
    for (const domain of MATH_DOMAINS) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 6; i++) await seedConfirmedProblem(domain, difficulty, `${domain}-${difficulty}-${tag}-mc-${i}`);
        for (let i = 0; i < 3; i++) await seedConfirmedProblem(domain, difficulty, `${domain}-${difficulty}-${tag}-spr-${i}`, "spr");
      }
    }
  }

  it("MST(4모듈) 조립: 모듈 키·시간 제한 저장, 모듈 간 문항 중복 없음, 섹션 내 연속 position(2026-09-28)", async () => {
    await seedMstPool("mst1");
    const { assembleMockExamSet } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({
      name: `MST 세트 ${Date.now()}`,
      difficultyTier: "standard",
      rwCount: 0,
      mathCount: 0,
      format: "mst",
      routing: false, // 레거시(Phase 1/2) 4모듈 — 라우팅 조립은 mock-exam-routing-assemble.integration.test.ts
    });
    expect(psql(`select format || '|' || (module_time_limits->>'rw_m1') || '|' || (module_time_limits->>'break') from mock_exam_sets where id = '${result.examSetId}';`)).toBe(
      "mst|1920|600",
    );
    const rows = psql(`
      select module_key || '|' || section || '|' || position || '|' || problem_id
      from mock_exam_set_items where exam_set_id = '${result.examSetId}' order by section, position;
    `)
      .split("\n")
      .filter(Boolean)
      .map((r) => {
        const [moduleKey, section, position, problemId] = r.split("|");
        return { moduleKey, section, position: Number(position), problemId };
      });
    // 모든 문항이 모듈에 귀속되고, 세트 전체(모듈 간 포함)에 같은 문항이 없다.
    expect(rows.every((r) => r.moduleKey && r.moduleKey !== "")).toBe(true);
    expect(new Set(rows.map((r) => r.problemId)).size).toBe(rows.length);
    // M1이 먼저 정원을 채우고, 풀이 모자라면 M2에 부족분이 보고된다(풀 크기는 이전 실행 잔여 데이터에 따라 달라
    // 여기서는 M1 정원과 상한만 고정 확인). Math 풀(72)은 22+22를 항상 채운다.
    const count = (k: string) => rows.filter((r) => r.moduleKey === k).length;
    expect(count("rw_m1")).toBe(27);
    expect(count("rw_m2")).toBeGreaterThan(0);
    expect(count("rw_m2")).toBeLessThanOrEqual(27);
    expect(count("math_m1")).toBe(22);
    expect(count("math_m2")).toBe(22);
    expect(result.shortfalls.some((s) => s.section === "math")).toBe(false);
    // V1 unique(exam_set_id, section, position)에 맞춘 섹션 내 연속 번호: rw_m2는 28부터, math_m2는 23부터.
    const positions = (section: string) => rows.filter((r) => r.section === section).map((r) => r.position);
    expect(positions("rw")).toEqual(Array.from({ length: positions("rw").length }, (_, i) => i + 1));
    expect(Math.min(...rows.filter((r) => r.moduleKey === "rw_m2").map((r) => r.position))).toBe(28);
    expect(Math.min(...rows.filter((r) => r.moduleKey === "math_m2").map((r) => r.position))).toBe(23);
    expect(result.readiness?.modules.find((m) => m.moduleKey === "rw_m2")?.ok).toBe(count("rw_m2") === 27);
    expect(result.readiness?.modules.find((m) => m.moduleKey === "math_m2")?.ok).toBe(true);

    // 출시 조건(2026-09-28): R&W M2가 정원 미달이면(여기서는 결정적으로 문항 3개를 빼서 재현) ready가 아니고,
    // 관리자에게 모듈·정원이 보이며, 공개·배정은 앱과 DB 양쪽에서 거부된다(학생이 Module 2에서 막히는 상황 원천 차단).
    psql(`delete from mock_exam_set_items where id in (select id from mock_exam_set_items where exam_set_id = '${result.examSetId}' and module_key = 'rw_m2' order by position desc limit 3);`);
    const { publishMockExamSet } = await import("./mock-exam-actions");
    await expect(publishMockExamSet(result.examSetId)).rejects.toThrow(/문항 구성이 완료되지 않아 공개할 수 없습니다: rw_m2 \d+\/27/);
    expect(psql(`select readiness_status || '|' || (readiness_report->'modules'->1->>'ok') from mock_exam_sets where id = '${result.examSetId}';`)).toBe("incomplete|false");
    // 트리거 직접 확인: 서비스 롤로 status를 강제로 바꿔도, 학생에게 배정해도 거부
    expect(() => psql(`update mock_exam_sets set status = 'published' where id = '${result.examSetId}';`)).toThrow(/공개할 수 없습니다/);
    expect(() =>
      psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('cccccccc-0000-0000-0000-000000000001', '${result.examSetId}', 'assigned');`),
    ).toThrow(/배정할 수 없습니다/);
  }, 180_000); // 문항 100여 개를 psql로 하나씩 심는 시딩이 기본 5초를 넘긴다

  it("MST 조립: 풀이 충분하면 ready가 되고 공개·배정이 허용된다", async () => {
    // R&W 풀을 54문항 이상으로 보강(기존 36 + 24). 같은 tier 공개 세트가 쓴 문항은 회피 대상일 뿐 부족 시 재사용된다.
    for (const domain of RW_DOMAINS) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 2; i++) await seedConfirmedProblem(domain, difficulty, `${domain}-${difficulty}-extra-${i}`);
      }
    }
    const { assembleMockExamSet, publishMockExamSet } = await import("./mock-exam-actions");
    const result = await assembleMockExamSet({ name: `MST 완성 세트 ${Date.now()}`, difficultyTier: "standard", rwCount: 0, mathCount: 0, format: "mst", routing: false });
    expect(result.readiness?.ready).toBe(true);
    expect(result.readiness?.modules.every((m) => m.ok)).toBe(true);
    expect(psql(`select count(*) || '|' || count(distinct problem_id) from mock_exam_set_items where exam_set_id = '${result.examSetId}';`)).toBe("98|98");
    // Phase 2: 조립 규칙 저장, Module 1에는 hard 없음(M1 배정 가능 규칙), 스냅샷 전량 저장, skill 쏠림·유사문항 위반 없음.
    expect(psql(`select assembly_rules->>'skillMaxSharePct' from mock_exam_sets where id = '${result.examSetId}';`)).toBe("50");
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${result.examSetId}' and module_key in ('rw_m1','math_m1') and not m1_eligible;`)).toBe("0");
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${result.examSetId}' and content_snapshot is null;`)).toBe("0");
    expect(result.readiness?.skillViolations).toEqual([]);
    expect(result.readiness?.skillWarnings ?? []).toBeInstanceOf(Array);
    expect(result.readiness?.eligibilityViolations).toEqual([]);
    expect(result.readiness?.similarityViolations).toEqual([]);
    expect(result.readiness?.missingSnapshotCount).toBe(0);
    await publishMockExamSet(result.examSetId);
    expect(psql(`select status || '|' || readiness_status from mock_exam_sets where id = '${result.examSetId}';`)).toBe("published|ready");
    const attemptId = psql(
      `insert into mock_exam_attempts (student_id, exam_set_id, status) values ('cccccccc-0000-0000-0000-000000000002', '${result.examSetId}', 'assigned') returning id;`,
    );
    expect(attemptId).toMatch(/[0-9a-f-]{36}/);
    // 배정 뒤 세트가 훼손되면(문항 삭제) Module 1 시작 자체가 관리자 오류로 거부된다 — 학생이 중간에 막히지 않는다.
    psql(`delete from mock_exam_set_items where id = (select id from mock_exam_set_items where exam_set_id = '${result.examSetId}' and module_key = 'rw_m2' limit 1);`);
    let err = "";
    try {
      psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000002', false); end $$; select mock_exam_start_mst('${attemptId}'); reset role;`);
    } catch (e) {
      err = String((e as { stderr?: string }).stderr ?? e);
    }
    expect(err).toContain("문항 구성이 완료되지 않아 시작할 수 없습니다");
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("assigned");
  }, 180_000); // 문항 100여 개를 psql로 하나씩 심는 시딩이 기본 5초를 넘긴다

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

// 2026-09-21(사용자 지시) — "비활성화된 학생 제외 + 전체 학생 배정 기능".
describe("모의고사 배정 — 전체 활성 학생 배정(2026-09-21)", () => {
  it("비활성 학생은 목록·배정 대상에서 빠지고, 활성 학생 전원에게 배정된다", async () => {
    try {
      const { listAllActiveStudentsForMockExamAction, assignMockExamToAllActiveStudentsAction, assembleMockExamSet, publishMockExamSet } =
        await import("./mock-exam-actions");

      const activeStudentId = psql(
        `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'bulk-assign-active-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
         returning id;`,
      );
      psql(`insert into profiles (id, role, name) values ('${activeStudentId}', 'student', '활성학생-벌크');`);
      psql(`insert into students (id, status) values ('${activeStudentId}', 'active');`);

      const inactiveStudentId = psql(
        `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'bulk-assign-inactive-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
         returning id;`,
      );
      psql(`insert into profiles (id, role, name) values ('${inactiveStudentId}', 'student', '비활성학생-벌크');`);
      psql(`insert into students (id, status) values ('${inactiveStudentId}', 'inactive');`);

      const students = await listAllActiveStudentsForMockExamAction();
      expect(students.some((s) => s.id === activeStudentId)).toBe(true);
      expect(students.some((s) => s.id === inactiveStudentId)).toBe(false);

      const set = await assembleMockExamSet({
        name: `전체 배정 테스트 세트 ${Date.now()}`,
        difficultyTier: "standard",
        rwCount: 5,
        mathCount: 5,
      });
      await publishMockExamSet(set.examSetId);

      const result = await assignMockExamToAllActiveStudentsAction({ examSetId: set.examSetId });
      expect(result.assignedCount).toBeGreaterThan(0);
      expect(result.skipped).toEqual([]);

      const attemptStatus = psql(
        `select status from mock_exam_attempts where student_id = '${activeStudentId}' and exam_set_id = '${set.examSetId}';`,
      );
      expect(attemptStatus).toBe("assigned");
      const inactiveAttemptCount = psql(
        `select count(*) from mock_exam_attempts where student_id = '${inactiveStudentId}' and exam_set_id = '${set.examSetId}';`,
      );
      expect(inactiveAttemptCount).toBe("0");
    } finally {
      // 활성 학생 전원 배정은 전역 작업이라 DB 에 응시가 계속 쌓인다 — 이 테스트가 만든 학생·세트·응시를 실행 끝에 정리한다(replica 모드, 단일 트랜잭션).
      psql(`begin; set local session_replication_role = replica;
        delete from mock_exam_answer_adjustments where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '전체 배정 테스트 세트 %');
        delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '전체 배정 테스트 세트 %');
        delete from mock_exam_attempt_modules where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '전체 배정 테스트 세트 %');
        delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '전체 배정 테스트 세트 %');
        delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '전체 배정 테스트 세트 %');
        delete from mock_exam_sets where name like '전체 배정 테스트 세트 %';
        delete from students where id in (select id from profiles where name in ('활성학생-벌크', '비활성학생-벌크'));
        delete from profiles where name in ('활성학생-벌크', '비활성학생-벌크');
        delete from auth.users where email like 'bulk-assign-%@example.com';
        commit;`);
    }
    }, 60_000);
});
