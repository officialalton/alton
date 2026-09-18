import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

// 대학 진학 정보 DB Part 2 — 실제 로컬 Postgres/Supabase(로컬 supabase start 인스턴스)에
// 대고 목록/검색/사이클 upsert/업데이트 추가를 검증한다. requireAdmin()은 next/headers
// 쿠키가 필요해 vitest 환경에서 그대로 못 쓰므로, mock-exam-actions.integration.test.ts와
// 같은 패턴으로 admin-auth/supabase-admin만 목으로 대체하고 DB는 실제 로컬 인스턴스를 쓴다.

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
  listUniversities,
  getUniversityDetail,
  upsertAdmissionCycle,
  addUniversityUpdate,
  updateUniversityBasics,
} = await import("./actions");

const RUN_ID = `p2-univ-test-${Date.now()}`;
let universityId: string;

describe("universities actions (목록/검색/사이클/업데이트, 실제 로컬 DB)", () => {
  beforeAll(async () => {
    const { data, error } = await admin
      .from("universities")
      .insert({
        rank_final: 9999,
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

  it("listUniversities: 이름으로 검색하면 시드된 실제 대학과 테스트 대학을 찾는다", async () => {
    const seeded = await listUniversities({ search: "Princeton" });
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.some((u) => u.name.includes("Princeton"))).toBe(true);

    const test = await listUniversities({ search: RUN_ID });
    expect(test).toHaveLength(1);
    expect(test[0].id).toBe(universityId);
  });

  it("listUniversities: 랭킹 범위 필터가 동작한다", async () => {
    const top10 = await listUniversities({ maxRank: 10 });
    expect(top10.length).toBeGreaterThan(0);
    for (const u of top10) {
      expect(u.rankFinal).toBeLessThanOrEqual(10);
    }
  });

  it("upsertAdmissionCycle: 새 사이클을 생성하고, 같은 연도로 다시 호출하면 갱신된다(upsert)", async () => {
    await upsertAdmissionCycle({
      universityId,
      cycleYear: 2027,
      testPolicy: "optional",
      gpaAverage: 3.9,
      essayCount: 2,
      acceptanceRate: 12.5,
    });

    let detail = await getUniversityDetail(universityId);
    expect(detail.cycles).toHaveLength(1);
    expect(detail.cycles[0].testPolicy).toBe("optional");
    expect(detail.cycles[0].essayCount).toBe(2);
    expect(detail.university.latestCycleYear).toBe(2027);

    await upsertAdmissionCycle({ universityId, cycleYear: 2027, testPolicy: "required", essayCount: 3 });
    detail = await getUniversityDetail(universityId);
    expect(detail.cycles).toHaveLength(1); // 같은 연도는 새로 안 생기고 덮어써야 한다
    expect(detail.cycles[0].testPolicy).toBe("required");
    expect(detail.cycles[0].essayCount).toBe(3);
  });

  it("upsertAdmissionCycle: 잘못된 연도는 거부한다", async () => {
    await expect(upsertAdmissionCycle({ universityId, cycleYear: 1500 })).rejects.toThrow();
  });

  it("addUniversityUpdate: 업데이트 타임라인 항목을 추가하고 조회된다", async () => {
    await addUniversityUpdate({
      universityId,
      title: "테스트 정책 변경",
      updateDate: "2026-09-19",
      summary: "요약",
      sourceUrl: "https://example.com",
    });
    const detail = await getUniversityDetail(universityId);
    expect(detail.updates.some((u) => u.title === "테스트 정책 변경")).toBe(true);
  });

  it("addUniversityUpdate: 제목이 없으면 거부한다", async () => {
    await expect(addUniversityUpdate({ universityId, title: "  ", updateDate: "2026-09-19" })).rejects.toThrow();
  });

  it("updateUniversityBasics: 지원 플랫폼·강점 전공을 갱신한다", async () => {
    await updateUniversityBasics({
      universityId,
      applicationPlatform: "Common App",
      strengthsPrograms: ["Computer Science", "Economics"],
    });
    const detail = await getUniversityDetail(universityId);
    expect(detail.university.applicationPlatform).toBe("Common App");
    expect(detail.university.strengthsPrograms).toEqual(["Computer Science", "Economics"]);
  });

  it("합격확률/가능성 예측 관련 필드나 함수가 존재하지 않는다", async () => {
    const detail = await getUniversityDetail(universityId);
    const allKeys = [...Object.keys(detail.university), ...(detail.cycles[0] ? Object.keys(detail.cycles[0]) : [])];
    for (const k of allKeys) {
      expect(k.toLowerCase()).not.toMatch(/chance|probability|predict/);
    }
  });
});
