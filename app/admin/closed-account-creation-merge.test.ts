import { describe, expect, it, vi } from "vitest";

// 2026-09-16(제품 오너 지시 — 재설계) — 계정 생성 카드는 상담 라이프사이클을
// 흉내 내면 안 되므로 admin_close_consultation()(상담 전용 종료 경로)을 타지
// 않는다. 대신 "신규 현황"에서 뺄 때 쓰는 것과 정확히 같은 기준
// (contracts.status='active')으로 listClosedConsultationsAction()이 "신규
// 내역"(구 지난 상담)에 직접 합성해 넣는지 확인한다 — account-creation-
// kanban-merge.test.ts가 확인하는 "신규 현황에서 빠짐"과 짝을 이룬다.

const { adminMockRef } = vi.hoisted(() => ({ adminMockRef: { current: null as unknown } }));

vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => adminMockRef.current }));
vi.mock("./consultation-kanban-data", () => ({ loadKanbanBoard: vi.fn() }));
vi.mock("./trial-onboarding-actions", () => ({ getTrialOnboardingPipelineAction: vi.fn() }));

type Row = Record<string, unknown>;

function makeAdminMock(tables: Record<string, Row[]>) {
  function chain(rows: Row[]) {
    const builder = {
      select: () => builder,
      not: () => builder,
      is: () => builder,
      in: () => builder,
      eq: () => builder,
      order: () => builder,
      then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return builder;
  }
  return { from: (table: string) => chain(tables[table] ?? []) };
}

describe("listClosedConsultationsAction — 계정 생성 완료 건 합성", () => {
  it("계약이 active인 계정 생성 학생은 closureType='contract_signed'로 신규 내역에 합성된다", async () => {
    adminMockRef.current = makeAdminMock({
      consultations: [],
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "jiman@bulqot.co" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "matchbox", child_auth_user_id: "child1" },
      ],
      contracts: [{ child_id: "child1", updated_at: "2026-09-16T18:00:00.000Z" }],
    });

    const { listClosedConsultationsAction } = await import("./consultation-kanban-actions");
    const { items, countsByType } = await listClosedConsultationsAction();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "link:student-row-1",
      contactName: "박보호자",
      contactEmail: "jiman@bulqot.co",
      closureType: "contract_signed",
      closedAt: "2026-09-16T18:00:00.000Z",
    });
    expect(countsByType.contract_signed).toBe(1);
  });

  it("계약이 아직 active가 아니면 신규 내역에 나타나지 않는다", async () => {
    adminMockRef.current = makeAdminMock({
      consultations: [],
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "jiman@bulqot.co" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "matchbox", child_auth_user_id: "child1" },
      ],
      contracts: [],
    });

    const { listClosedConsultationsAction } = await import("./consultation-kanban-actions");
    const { items } = await listClosedConsultationsAction();

    expect(items).toHaveLength(0);
  });

  it("실제 상담의 closure_type 기반 종료 건은 기존처럼 그대로 나온다(회귀 방지)", async () => {
    adminMockRef.current = makeAdminMock({
      consultations: [
        {
          id: "c1",
          contact_name: "김민지",
          contact_email: "minji@example.com",
          closure_type: "trial_no_convert",
          closed_at: "2026-09-01T00:00:00.000Z",
          closure_review_text: "메모",
        },
      ],
      trial_onboarding_links: [],
    });

    const { listClosedConsultationsAction } = await import("./consultation-kanban-actions");
    const { items } = await listClosedConsultationsAction();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "c1", closureType: "trial_no_convert" });
  });
});
