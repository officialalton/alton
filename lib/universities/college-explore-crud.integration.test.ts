import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

// College Explore 확장 필드(인구통계/재정지원 프로그램/소속 정보) 관리자 CRUD를
// 실제 로컬 Postgres/Supabase(로컬 supabase start 인스턴스)에 대고 검증한다.
// requireAdmin()은 next/headers 쿠키가 필요해 vitest 환경에서 그대로 못 쓰므로,
// actions.integration.test.ts와 같은 패턴으로 admin-auth/supabase-admin만 목으로
// 대체하고 DB는 실제 로컬 인스턴스를 쓴다.

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({ supabase: admin, adminUserId: "test-admin" }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => admin,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const {
  listUniversityDemographicsAdmin,
  upsertUniversityDemographic,
  deleteUniversityDemographic,
  listUniversityFinancialAidProgramsAdmin,
  upsertUniversityFinancialAidProgram,
  deleteUniversityFinancialAidProgram,
  listUniversityAffiliationsAdmin,
  upsertUniversityAffiliation,
  deleteUniversityAffiliation,
} = await import("./actions");

const RUN_ID = `p-college-explore-crud-${Date.now()}`;
let universityId: string;

describe("college explore CRUD (demographics/financial_aid_programs/affiliations, 실제 로컬 DB)", () => {
  beforeAll(async () => {
    const { data, error } = await admin
      .from("universities")
      .insert({
        rank_final: 9998,
        name: `${RUN_ID} Test University`,
        country: "United States",
        city: "Testville",
        state: "TS",
        public_private: "Private",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "테스트용 대학 생성 실패");
    universityId = data.id;
  });

  afterAll(async () => {
    await admin.from("universities").delete().eq("id", universityId);
  });

  it("demographics: 추가(insert) 후 조회되고, 같은 id로 다시 저장하면 갱신된다", async () => {
    await upsertUniversityDemographic({
      universityId,
      cycleYear: 2027,
      category: "gender_male",
      populationScope: "all_students",
      pct: 48.5,
      valueStatus: "reported",
      verificationStatus: "official",
      notes: "테스트",
    });

    let rows = await listUniversityDemographicsAdmin(universityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].pct).toBe(48.5);
    expect(rows[0].verificationStatus).toBe("official");
    expect(rows[0].verifiedAt).not.toBeNull();

    await upsertUniversityDemographic({
      id: rows[0].id,
      universityId,
      cycleYear: 2027,
      category: "gender_male",
      populationScope: "all_students",
      pct: 49.1,
      valueStatus: "reported",
      verificationStatus: "unverified",
    });
    rows = await listUniversityDemographicsAdmin(universityId);
    expect(rows).toHaveLength(1); // update, 새 row 안 생김
    expect(rows[0].pct).toBe(49.1);
    expect(rows[0].verificationStatus).toBe("unverified");
    expect(rows[0].verifiedAt).toBeNull(); // unverified로 바뀌면 verified_at 초기화

    await deleteUniversityDemographic(rows[0].id);
    rows = await listUniversityDemographicsAdmin(universityId);
    expect(rows).toHaveLength(0);
  });

  it("demographics: 동일 (university_id, cycle_year, category, population_scope) 중복은 거부된다", async () => {
    await upsertUniversityDemographic({
      universityId,
      cycleYear: 2028,
      category: "race_asian_pacific_islander",
      populationScope: "all_students",
      pct: 20,
      valueStatus: "reported",
      verificationStatus: "official",
    });
    await expect(
      upsertUniversityDemographic({
        universityId,
        cycleYear: 2028,
        category: "race_asian_pacific_islander",
        populationScope: "all_students",
        pct: 21,
        valueStatus: "reported",
        verificationStatus: "official",
      }),
    ).rejects.toThrow();
  });

  it("financial aid programs: 추가/수정/삭제", async () => {
    await upsertUniversityFinancialAidProgram({
      universityId,
      programType: "need_based_grant",
      name: "테스트 그랜트",
      eligibilityScope: "all_students",
      recipientPct: 55,
      avgAwardAmount: 30000,
      cycleYear: 2027,
      valueStatus: "reported",
      verificationStatus: "secondary",
    });

    let rows = await listUniversityFinancialAidProgramsAdmin(universityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("테스트 그랜트");
    expect(rows[0].verifiedAt).not.toBeNull();

    await upsertUniversityFinancialAidProgram({
      id: rows[0].id,
      universityId,
      programType: "need_based_grant",
      name: "테스트 그랜트 (수정)",
      eligibilityScope: "all_students",
      valueStatus: "reported",
      verificationStatus: "unverified",
    });
    rows = await listUniversityFinancialAidProgramsAdmin(universityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("테스트 그랜트 (수정)");
    expect(rows[0].verifiedAt).toBeNull();

    await deleteUniversityFinancialAidProgram(rows[0].id);
    rows = await listUniversityFinancialAidProgramsAdmin(universityId);
    expect(rows).toHaveLength(0);
  });

  it("financial aid programs: 존재하지 않는 university_id는 FK 제약으로 거부된다", async () => {
    await expect(
      upsertUniversityFinancialAidProgram({
        universityId: "00000000-0000-0000-0000-000000000000",
        programType: "merit_scholarship",
        name: "테스트",
        eligibilityScope: "all_students",
        valueStatus: "reported",
        verificationStatus: "unverified",
      }),
    ).rejects.toThrow();
  });

  it("affiliations: 추가/수정/삭제", async () => {
    await upsertUniversityAffiliation({
      universityId,
      kind: "ncaa_sport",
      label: "테스트 종목",
      division: "Division I",
      verificationStatus: "official",
    });

    let rows = await listUniversityAffiliationsAdmin(universityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("테스트 종목");
    expect(rows[0].verifiedAt).not.toBeNull();

    await upsertUniversityAffiliation({
      id: rows[0].id,
      universityId,
      kind: "ivy_league",
      label: "테스트 종목 (수정)",
      verificationStatus: "unverified",
    });
    rows = await listUniversityAffiliationsAdmin(universityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("ivy_league");
    expect(rows[0].verifiedAt).toBeNull();

    await deleteUniversityAffiliation(rows[0].id);
    rows = await listUniversityAffiliationsAdmin(universityId);
    expect(rows).toHaveLength(0);
  });
});
