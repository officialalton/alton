import { describe, expect, it, vi } from "vitest";

// 2026-09-16(실사용 중 발견) — "신규 현황" 카드 상세 패널(getAccountCreationCardDetail)이
// 계정 생성(consultation_id null) 학생의 consent_confirmed_at을 항상 null로 합성해,
// 보호자가 record_trial_smart_notes_consent()로 실제 동의를 마쳐도 "보호자 동의 확인
// 대기 중" 배지가 상세 패널에서 절대 안 풀렸다(목록 카드와 별개 경로 — account-creation-
// kanban-merge.test.ts가 고정하는 목록 쪽 결함과 원인은 같지만 함수가 다르다).

const { adminMockRef } = vi.hoisted(() => ({ adminMockRef: { current: null as unknown } }));

vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => adminMockRef.current }));
vi.mock("./trial-pipeline-data", () => ({
  loadTrialPipelinesBatch: vi.fn(async (_admin: unknown, candidates: { consultationId: string }[]) => {
    const map = new Map();
    for (const c of candidates) map.set(c.consultationId, { steps: [] });
    return map;
  }),
}));

type Row = Record<string, unknown>;

function makeAdminMock(tables: Record<string, Row[] | Row | null>) {
  function chain(result: Row[] | Row | null) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: result, error: null }),
      then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: result, error: null }),
    };
    return builder;
  }
  return {
    from: (table: string) => chain(tables[table] ?? null),
  };
}

describe("getAccountCreationCardDetail — 상세 패널 동의 상태", () => {
  it("trial_smart_notes_consents에 실제 동의 기록이 있으면 consent_confirmed_at을 채운다", async () => {
    adminMockRef.current = makeAdminMock({
      trial_onboarding_link_students: {
        id: "student-row-1",
        link_id: "link1",
        student_name: "matchbox",
        child_auth_user_id: "child1",
        created_at: "2026-09-16T17:58:38.000Z",
      },
      trial_onboarding_links: { id: "link1", guardian_name: "박보호자", guardian_email: "jiman@bulqot.co" },
      trial_smart_notes_consents: { confirmed_at: "2026-09-16T18:05:28.980Z" },
      contracts: null,
    });

    const { getConsultationCardDetailAction } = await import("./consultation-kanban-actions");
    const detail = await getConsultationCardDetailAction("link:student-row-1");

    expect(detail.consultation.consent_confirmed_at).toBe("2026-09-16T18:05:28.980Z");
  });

  it("동의 기록이 없으면 여전히 null이다", async () => {
    adminMockRef.current = makeAdminMock({
      trial_onboarding_link_students: {
        id: "student-row-1",
        link_id: "link1",
        student_name: "matchbox",
        child_auth_user_id: "child1",
        created_at: "2026-09-16T17:58:38.000Z",
      },
      trial_onboarding_links: { id: "link1", guardian_name: "박보호자", guardian_email: "jiman@bulqot.co" },
      trial_smart_notes_consents: null,
      contracts: null,
    });

    const { getConsultationCardDetailAction } = await import("./consultation-kanban-actions");
    const detail = await getConsultationCardDetailAction("link:student-row-1");

    expect(detail.consultation.consent_confirmed_at).toBeNull();
  });
});
