import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

// 지시서 E — 10개교 실 UAT: 실제 시딩된 대학(Johns Hopkins University, 이번 세션에서
// apply.jhu.edu를 실제 WebFetch로 재검증한 5개교 중 하나)에 대해 실제 파이프라인을
// 다시 한 번 실행해 최종 검수 체크리스트 항목을 직접 확인한다.
// - pending 상태 출처 URL은 크롤러가 사용하지 않는다.
// - 봇 실패(fetch_failed) 시 기존 공개값(university_admission_metrics)이 그대로 유지된다.
// - 동일 대학 연속 요청은 하나의 job으로 합쳐진다(냉각시간 재확인, 실 대학 대상).

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

let TEST_USER_ID: string;

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({ supabase: admin, adminUserId: TEST_USER_ID }),
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: TEST_USER_ID },
    profile: { role: "admin", name: "Test E-UAT" },
    supabase: admin,
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { requestUniversityRefresh, listUpdateProposals } = await import("./refresh-actions");

let jhuId: string;
let pendingUrlId: string;
let existingMetricId: string;

describe("지시서 E: 실 시딩 대학(JHU) 대상 실제 재검증", () => {
  beforeAll(async () => {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: `e-uat-${Date.now()}@example.test`,
      email_confirm: true,
      password: "test-password-12345",
    });
    if (authError || !authUser.user) throw new Error(authError?.message ?? "테스트 사용자 생성 실패");
    TEST_USER_ID = authUser.user.id;

    const { data: uni, error: uniError } = await admin
      .from("universities")
      .select("id")
      .eq("name", "Johns Hopkins University")
      .single();
    if (uniError || !uni) throw new Error(uniError?.message ?? "JHU 시딩 데이터 없음 - P2 seed 확인 필요");
    jhuId = uni.id;

    // 이번 세션 마이그레이션(P10)이 이미 apply.jhu.edu를 approved로 등록해 두었음.
    // 여기서는 pending URL을 하나 더 추가해 "승인 전에는 공식 출처로 안 쓰이는지" 확인.
    const { data: pending, error: pendingError } = await admin
      .from("university_source_urls")
      .insert({
        university_id: jhuId,
        url: "https://apply.jhu.edu/this-should-never-be-fetched-pending-test",
        source_type: "deadlines",
        is_official: true,
        status: "pending",
      })
      .select("id")
      .single();
    if (pendingError || !pending) throw new Error(pendingError?.message ?? "pending URL 생성 실패");
    pendingUrlId = pending.id;

    // 기존 공개값 하나를 심어 두고, 이번 회차 실행 후에도 그대로인지 대조.
    const { data: metric, error: metricError } = await admin
      .from("university_admission_metrics")
      .insert({
        university_id: jhuId,
        cycle_year: 2027,
        cohort: "admitted",
        metric_key: "gpa_average",
        value: 3.91,
        verification_status: "secondary",
      })
      .select("id")
      .single();
    if (metricError || !metric) throw new Error(metricError?.message ?? "기존값 시드 실패");
    existingMetricId = metric.id;
  });

  afterAll(async () => {
    await admin.from("university_source_urls").delete().eq("id", pendingUrlId);
    await admin.from("university_admission_metrics").delete().eq("id", existingMetricId);
    await admin.from("university_update_proposals").delete().eq("university_id", jhuId);
    await admin.from("university_refresh_jobs").delete().eq("university_id", jhuId);
    if (TEST_USER_ID) await admin.auth.admin.deleteUser(TEST_USER_ID);
  });

  it(
    "JHU 실제 파이프라인 실행 + pending URL 미사용 + 기존 공개값 불변 + 중복요청 병합",
    async () => {
      const job = await requestUniversityRefresh(jhuId);
      expect(["succeeded", "failed", "queued"]).toContain(job.status);

      if (job.status !== "queued") {
        const proposals = await listUpdateProposals(jhuId);
        // pending URL은 크롤러가 순회하지 않으므로 그 URL을 근거로 한 변경안이 없어야 한다.
        const usedPending = proposals.some((p) => p.sourceUrlId === pendingUrlId);
        expect(usedPending).toBe(false);
      }

      // 기존 공개값은 이 실행에서 어떤 UPDATE도 받지 않아야 한다(runRefreshJob은
      // university_admission_metrics를 직접 쓰지 않고 proposal만 생성하므로).
      const { data: metricAfter } = await admin
        .from("university_admission_metrics")
        .select("value")
        .eq("id", existingMetricId)
        .single();
      expect(metricAfter?.value).toBe(3.91);

      // 연속 재요청 → 같은 job(냉각시간 병합).
      const again = await requestUniversityRefresh(jhuId);
      expect(again.id).toBe(job.id);
    },
    30_000,
  );
});
