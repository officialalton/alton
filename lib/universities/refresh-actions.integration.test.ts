import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

// 대학 진학 정보 DB Part 9 — 실제 로컬 Postgres(로컬 supabase 인스턴스)에 대고
// 갱신 요청 큐/변경안 검토를 검증한다. 크롤러 fetch 부분은 실제 외부 HTTP 요청을
// 보낸다(mock 아님, 지시서 요구사항) — 승인된 공개 대학 공식 페이지 1개 + 존재하지
// 않는 URL 1개를 실제로 방문한다.

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

// requested_by/reviewed_by는 auth.users(id) FK라 실제 auth 사용자가 있어야 한다.
let TEST_ADMIN_ID: string;

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({ supabase: admin, adminUserId: TEST_ADMIN_ID }),
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: TEST_ADMIN_ID },
    profile: { role: "admin", name: "Test Admin" },
    supabase: admin,
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => admin,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { requestUniversityRefresh, getLatestRefreshJob, listUpdateProposals, reviewUpdateProposal, rollbackAppliedProposal } =
  await import("./refresh-actions");

const RUN_ID = `p9-refresh-test-${Date.now()}`;
let universityId: string;
let goodSourceUrlId: string;
let badSourceUrlId: string;

describe("정보 수집 봇 + 변경안 검토(P9, 실제 로컬 DB + 실제 외부 HTTP 요청)", () => {
  beforeAll(async () => {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: `${RUN_ID}@example.test`,
      email_confirm: true,
      password: "test-password-12345",
    });
    if (authError || !authUser.user) throw new Error(authError?.message ?? "테스트용 auth 사용자 생성 실패");
    TEST_ADMIN_ID = authUser.user.id;

    const { data: uni, error: uniError } = await admin
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
    if (uniError || !uni) throw new Error(uniError?.message ?? "테스트용 대학 생성 실패");
    universityId = uni.id;

    // 실제 존재하는 공개 대학 공식 페이지(이전 라운드 P4/P7/P8 백필에도 쓰인 공식 도메인) —
    // robots.txt 존중/실제 fetch 검증용. 페이지 구조가 바뀌어도 이 테스트는 "접근 성공
    // 여부"와 "변경안이 생성되는지"만 확인하므로 깨지지 않는다.
    const { data: good, error: goodError } = await admin
      .from("university_source_urls")
      .insert({
        university_id: universityId,
        url: "https://mitadmissions.org/",
        source_type: "deadlines",
        is_official: true,
        status: "approved",
      })
      .select("id")
      .single();
    if (goodError || !good) throw new Error(goodError?.message ?? "정상 출처 URL 생성 실패");
    goodSourceUrlId = good.id;

    // 존재하지 않는 URL — fetch_failed 케이스 검증용(실제 네트워크 요청, 404/DNS 실패 등).
    const { data: bad, error: badError } = await admin
      .from("university_source_urls")
      .insert({
        university_id: universityId,
        url: "https://mitadmissions.org/this-page-definitely-does-not-exist-p9-test-9999",
        source_type: "deadlines",
        is_official: true,
        status: "approved",
      })
      .select("id")
      .single();
    if (badError || !bad) throw new Error(badError?.message ?? "실패 케이스 URL 생성 실패");
    badSourceUrlId = bad.id;
  });

  afterAll(async () => {
    await admin.from("universities").delete().eq("id", universityId);
    if (TEST_ADMIN_ID) await admin.auth.admin.deleteUser(TEST_ADMIN_ID);
  });

  it(
    "requestUniversityRefresh: 실제로 크롤을 돌려 job이 succeeded로 끝나고, 실패 URL은 fetch_failed 변경안으로 남는다",
    async () => {
      const job = await requestUniversityRefresh(universityId);
      expect(job.universityId).toBe(universityId);
      expect(["succeeded", "failed", "queued"]).toContain(job.status);

      const latest = await getLatestRefreshJob(universityId);
      expect(latest?.id).toBe(job.id);

      if (job.status === "queued") {
        // 동시 실행 한도에 걸린 드문 경우 — 변경안이 아직 없을 수 있으니 스킵.
        return;
      }
      expect(job.status).toBe("succeeded");

      const proposals = await listUpdateProposals(universityId);
      expect(proposals.length).toBeGreaterThan(0);

      const failedOnes = proposals.filter((p) => p.sourceUrlId === badSourceUrlId);
      expect(failedOnes.length).toBeGreaterThan(0);
      expect(failedOnes.every((p) => p.resultType === "fetch_failed")).toBe(true);
      expect(failedOnes[0].evidenceLocation).toContain("this-page-definitely-does-not-exist");

      const goodOnes = proposals.filter((p) => p.sourceUrlId === goodSourceUrlId);
      expect(goodOnes.length).toBeGreaterThan(0);
      expect(goodOnes.every((p) => p.resultType !== "fetch_failed")).toBe(true);
    },
    30_000,
  );

  it("requestUniversityRefresh: 완료 직후 재요청하면 새 job을 만들지 않고 같은(냉각중) job을 반환한다(중복 실행 병합)", async () => {
    const before = await getLatestRefreshJob(universityId);
    const again = await requestUniversityRefresh(universityId);
    expect(again.id).toBe(before?.id);
  });

  it("reviewUpdateProposal: admission_metrics 대상 변경안을 승인하면 실제로 대상 테이블 값이 바뀐다", async () => {
    const { data: proposal, error } = await admin
      .from("university_update_proposals")
      .insert({
        university_id: universityId,
        field_area: "admission_metric",
        target_table: "university_admission_metrics",
        target_record_key: { cycle_year: 2027, cohort: "admitted", metric_key: "sat_total_25" },
        cycle_year: 2027,
        cohort: "admitted",
        result_type: "new",
        status: "pending",
        proposed_value: { value: 1480, unit: "points", verification_status: "secondary" },
        evidence_excerpt: "SAT 25th percentile: 1480 (test fixture)",
        evidence_location: "https://example.test/cds",
      })
      .select("id")
      .single();
    if (error || !proposal) throw new Error(error?.message ?? "테스트 변경안 생성 실패");

    await reviewUpdateProposal({ proposalId: proposal.id, decision: "approved" });

    const { data: metric } = await admin
      .from("university_admission_metrics")
      .select("value, unit, verification_status")
      .match({ university_id: universityId, cycle_year: 2027, cohort: "admitted", metric_key: "sat_total_25" })
      .single();
    expect(metric?.value).toBe(1480);
    expect(metric?.unit).toBe("points");

    const { data: after } = await admin
      .from("university_update_proposals")
      .select("status, applied_at")
      .eq("id", proposal.id)
      .single();
    expect(after?.status).toBe("approved");
    expect(after?.applied_at).not.toBeNull();
  });

  it("reviewUpdateProposal: 거절/보류하면 대상 테이블이 바뀌지 않는다", async () => {
    const { data: proposal, error } = await admin
      .from("university_update_proposals")
      .insert({
        university_id: universityId,
        field_area: "admission_metric",
        target_table: "university_admission_metrics",
        target_record_key: { cycle_year: 2027, cohort: "admitted", metric_key: "act_composite_25" },
        cycle_year: 2027,
        cohort: "admitted",
        result_type: "new",
        status: "pending",
        proposed_value: { value: 34, unit: "points" },
      })
      .select("id")
      .single();
    if (error || !proposal) throw new Error(error?.message ?? "테스트 변경안 생성 실패");

    await reviewUpdateProposal({ proposalId: proposal.id, decision: "rejected", reviewReason: "출처 신뢰도 부족(테스트)" });

    const { data: metric } = await admin
      .from("university_admission_metrics")
      .select("id")
      .match({ university_id: universityId, cycle_year: 2027, cohort: "admitted", metric_key: "act_composite_25" })
      .maybeSingle();
    expect(metric).toBeNull();

    const { data: after } = await admin.from("university_update_proposals").select("status, applied_at").eq("id", proposal.id).single();
    expect(after?.status).toBe("rejected");
    expect(after?.applied_at).toBeNull();
  });

  it("rollbackAppliedProposal: 승인 취소 시 이전 값으로 복원한다", async () => {
    await admin.from("university_admission_metrics").insert({
      university_id: universityId,
      cycle_year: 2027,
      cohort: "admitted",
      metric_key: "gpa_average",
      value: 3.9,
      verification_status: "official",
    });

    const { data: proposal } = await admin
      .from("university_update_proposals")
      .insert({
        university_id: universityId,
        field_area: "admission_metric",
        target_table: "university_admission_metrics",
        target_record_key: { cycle_year: 2027, cohort: "admitted", metric_key: "gpa_average" },
        cycle_year: 2027,
        cohort: "admitted",
        result_type: "changed",
        status: "pending",
        proposed_value: { value: 3.95 },
      })
      .select("id")
      .single();

    await reviewUpdateProposal({ proposalId: proposal!.id, decision: "approved" });
    const { data: afterApply } = await admin
      .from("university_admission_metrics")
      .select("value")
      .match({ university_id: universityId, cycle_year: 2027, cohort: "admitted", metric_key: "gpa_average" })
      .single();
    expect(afterApply?.value).toBe(3.95);

    await rollbackAppliedProposal(proposal!.id);
    const { data: afterRollback } = await admin
      .from("university_admission_metrics")
      .select("value")
      .match({ university_id: universityId, cycle_year: 2027, cohort: "admitted", metric_key: "gpa_average" })
      .single();
    expect(afterRollback?.value).toBe(3.9);

    const { data: proposalAfter } = await admin.from("university_update_proposals").select("status, applied_at").eq("id", proposal!.id).single();
    expect(proposalAfter?.status).toBe("held");
    expect(proposalAfter?.applied_at).toBeNull();
  });
});
