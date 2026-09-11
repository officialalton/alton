import { describe, expect, it, vi } from "vitest";

// 2026-09-10(P1-B 신규 통합 보드) — "신규 현황" 보드가 상담 유입뿐 아니라
// "계정 생성"(consultation_id가 null인 trial_onboarding_links) 유입도
// 함께 보여준다. 이 테스트는 (1) 계정이 실제로 만들어진 학생만 카드로
// 나타나는지, (2) 그 카드에 intakeSource='account_creation'이 붙는지,
// (3) consultations 테이블에는 아무 것도 쓰지 않는지(가짜 상담 레코드
// 없음 — insert 호출 자체가 없음을 확인), (4) 카드 수가 늘어도 관련
// 테이블 조회가 고정 횟수인지를 검증한다.

const { listConsultationsMock } = vi.hoisted(() => ({
  listConsultationsMock: vi.fn(),
}));

vi.mock("./consultation-scheduling-actions", () => ({
  listConsultationsForAdmin: listConsultationsMock,
}));

type Row = Record<string, unknown>;

function makeAdminMock(tables: Record<string, Row[]>) {
  const callCounts: Record<string, number> = {};
  const insertCalls: { table: string; payload: unknown }[] = [];

  function chain(rows: Row[]) {
    const builder = {
      select: () => builder,
      not: () => builder,
      is: () => builder,
      in: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (v: { data: Row[] }) => void) => resolve({ data: rows }),
    };
    return builder;
  }

  return {
    callCounts,
    insertCalls,
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      if (table === "consultations") {
        // consultations에는 select만 허용하고 insert를 호출하면 잡아낸다
        // (가짜 상담 레코드를 만들면 안 된다는 요구사항의 회귀 감지용).
        return {
          ...chain(tables.consultations ?? []),
          insert: (payload: unknown) => {
            insertCalls.push({ table: "consultations", payload });
            throw new Error("가짜 상담 레코드 생성 금지 — consultations.insert가 호출됨");
          },
        };
      }
      return chain(tables[table] ?? []);
    },
  };
}

describe("loadKanbanBoard — 계정 생성 유입 통합", () => {
  it("계정이 생성된 학생만 카드로 나타나고 intakeSource가 account_creation이다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [
        { id: "link1", guardian_name: "박보호자", guardian_email: "parent@example.com" },
      ],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "학생1", child_auth_user_id: "child1", created_at: "2026-01-01" },
      ],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("link:student-row-1");
    expect(cards[0].intakeSource).toBe("account_creation");
    expect(cards[0].contact_name).toBe("박보호자");
    expect(cards[0].child_id).toBe("child1");
    expect(admin.insertCalls).toHaveLength(0);
  });

  it("계정이 아직 안 만들어진(child_auth_user_id 없음) 학생은 카드로 나타나지 않는다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "parent@example.com" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "학생1", child_auth_user_id: null, created_at: "2026-01-01" },
      ],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(0);
  });

  it("상담 유입 카드는 intakeSource가 consultation이다", async () => {
    listConsultationsMock.mockResolvedValue([
      {
        id: "c1",
        contact_name: "김상담",
        contact_email: "consult@example.com",
        status: "requested",
        outcome: null,
        child_id: null,
        is_child_onboarding_card: false,
      },
    ]);
    const admin = makeAdminMock({ trial_onboarding_links: [] });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(1);
    expect(cards[0].intakeSource).toBe("consultation");
  });

  it("계정 생성 카드 수가 늘어도 관련 테이블 조회는 고정 횟수다(N+1 아님)", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const links = Array.from({ length: 50 }, (_, i) => ({
      id: `link${i}`,
      guardian_name: `보호자${i}`,
      guardian_email: `p${i}@example.com`,
    }));
    const students = links.map((l, i) => ({
      id: `student-row-${i}`,
      link_id: l.id,
      student_name: `학생${i}`,
      child_auth_user_id: `child${i}`,
      created_at: "2026-01-01",
    }));
    const admin = makeAdminMock({
      trial_onboarding_links: links,
      trial_onboarding_link_students: students,
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(50);
    expect(admin.callCounts.trial_onboarding_links).toBe(1);
    expect(admin.callCounts.trial_onboarding_link_students).toBe(1);
  });
});
