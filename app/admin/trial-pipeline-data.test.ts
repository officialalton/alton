import { describe, expect, it } from "vitest";
import { loadTrialPipelinesBatch } from "./trial-pipeline-data";

// 2026-09-10(P1 성능 배치) — 매칭 하단 "상담 → 체험 → 정규 전환" 현황표의
// 카드별 N+1(카드마다 인증+순차 조회 최대 10회)을 배치 쿼리로 교체했다.
// 이 테스트는 (1) 후보 수와 무관하게 테이블별 쿼리 횟수가 고정인지,
// (2) 여러 후보의 단계 판정이 서로 뒤섞이지 않고 정확히 분리되는지를
// 검증한다.

type Row = Record<string, unknown>;

function makeAdminMock(tableData: Record<string, Row[]>) {
  const callCountByTable: Record<string, number> = {};

  function builder(table: string) {
    const rows = tableData[table] ?? [];
    callCountByTable[table] = (callCountByTable[table] ?? 0) + 1;
    const chain = {
      select: () => chain,
      in: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (resolve: (v: { data: Row[] }) => void) => resolve({ data: rows }),
    };
    return chain;
  }

  return {
    from: (table: string) => builder(table),
    callCountByTable,
  };
}

describe("loadTrialPipelinesBatch", () => {
  it("빈 후보 목록은 아무 쿼리도 하지 않는다", async () => {
    const admin = makeAdminMock({});
    const result = await loadTrialPipelinesBatch(admin as never, []);
    expect(result.size).toBe(0);
    expect(Object.keys(admin.callCountByTable).length).toBe(0);
  });

  it("후보가 여러 명이어도 테이블별 쿼리는 고정 횟수만 발생한다(N+1 아님)", async () => {
    const admin = makeAdminMock({
      consultations: [
        { id: "c1", trial_entitlement_grant_status: "granted", trial_entitlement_grant_error: null },
        { id: "c2", trial_entitlement_grant_status: "not_applicable", trial_entitlement_grant_error: null },
        { id: "c3", trial_entitlement_grant_status: "not_applicable", trial_entitlement_grant_error: null },
      ],
      subject_enrollments: [
        { id: "se1", child_id: "child1", status: "active", created_at: "2026-02-01" },
        { id: "se2", child_id: "child2", status: "planned", created_at: "2026-02-01" },
      ],
      teacher_assignments: [{ subject_enrollment_id: "se1" }],
      trial_smart_notes_consents: [{ child_id: "child1" }],
      entitlement_grants: [{ child_id: "child1" }],
      sessions: [{ subject_enrollment_id: "se1", smart_notes_status: "completed", created_at: "2026-02-02" }],
      lesson_reviews: [{ subject_enrollment_id: "se1" }],
      trial_regular_progress_selections: [{ subject_enrollment_id: "se1" }],
      contracts: [{ id: "ct1", child_id: "child1", status: "active", created_at: "2026-02-03" }],
      contract_versions: [{ contract_id: "ct1", docusign_envelope_id: "env1", version_number: 1 }],
      purchases: [{ contract_id: "ct1" }],
    });

    const candidates = [
      { consultationId: "c1", childId: "child1", trialIntentConfirmedAt: "2026-01-01" },
      { consultationId: "c2", childId: "child2", trialIntentConfirmedAt: null },
      { consultationId: "c3", childId: null, trialIntentConfirmedAt: null },
    ];

    const result = await loadTrialPipelinesBatch(admin as never, candidates);

    // 후보 3명 각각 결과가 있어야 한다.
    expect(result.size).toBe(3);

    // 후보 1(child1) — 모든 단계가 채워진 경로.
    const p1 = result.get("c1")!;
    expect(p1.subjectEnrollmentId).toBe("se1");
    expect(p1.steps.find((s) => s.key === "assignment")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "trial_booking")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "smart_notes")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "review")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "regular_intent")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "contract_sent")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "signed")?.done).toBe(true);
    expect(p1.steps.find((s) => s.key === "purchase")?.done).toBe(true);

    // 후보 2(child2) — 수강 계획만 있고 나머지는 전부 미완료여야 한다(후보 1의
    // 데이터와 섞이면 안 됨).
    const p2 = result.get("c2")!;
    expect(p2.subjectEnrollmentId).toBe("se2");
    expect(p2.steps.find((s) => s.key === "assignment")?.done).toBe(false);
    expect(p2.steps.find((s) => s.key === "trial_booking")?.done).toBe(false);
    expect(p2.steps.find((s) => s.key === "contract_sent")?.done).toBe(false);

    // 후보 3(childId 없음) — account_linked 등 자녀 연결 관련 단계가 전부 미완료.
    const p3 = result.get("c3")!;
    expect(p3.subjectEnrollmentId).toBeNull();
    expect(p3.steps.find((s) => s.key === "account_linked")?.done).toBe(false);

    // 테이블별 쿼리 횟수가 후보 수(3명)와 무관하게 고정인지 확인 — 각 테이블
    // 정확히 1회씩만 조회돼야 한다(N+1이면 후보 수만큼 늘어난다).
    for (const table of [
      "consultations",
      "subject_enrollments",
      "teacher_assignments",
      "trial_smart_notes_consents",
      "entitlement_grants",
      "sessions",
      "lesson_reviews",
      "trial_regular_progress_selections",
      "contracts",
      "contract_versions",
      "purchases",
    ]) {
      expect(admin.callCountByTable[table]).toBe(1);
    }
  });
});
