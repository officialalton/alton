import { describe, expect, it, vi } from "vitest";

// 2026-09-29(6단계) — 체험 Smart Notes 동의가 폐지돼 "신규 현황" 카드 상세 패널
// (getAccountCreationCardDetail)은 동의 기록을 더 이상 조회하지 않는다.

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
  it("2026-09-29(6단계) — 체험 Smart Notes 동의가 폐지돼 trial_smart_notes_consents를 조회하지 않고 consent_confirmed_at은 null이다", async () => {
    const fromSpy = vi.fn();
    const inner = makeAdminMock({
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
    adminMockRef.current = {
      from: (table: string) => {
        fromSpy(table);
        return inner.from(table);
      },
    };

    const { getConsultationCardDetailAction } = await import("./consultation-kanban-actions");
    const detail = await getConsultationCardDetailAction("link:student-row-1");

    expect(detail.consultation.consent_confirmed_at).toBeNull();
    expect(fromSpy).not.toHaveBeenCalledWith("trial_smart_notes_consents");
  });
});
