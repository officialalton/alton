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
  queryConsultationsInRange: listConsultationsMock,
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
    // P4-1(B, 2026-09-11) — loadKanbanBoard()가 아카이브된 가구의 자녀 카드를
    // 빼기 위해 archived_household_profile_ids() RPC를 이 클라이언트로 1회
    // 호출한다(목록당 왕복 +1 고정). 이 스펙에는 아카이브된 가구가 없다.
    rpc: (fn: string) => {
      callCounts[`rpc:${fn}`] = (callCounts[`rpc:${fn}`] ?? 0) + 1;
      return Promise.resolve({ data: [], error: null });
    },
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

  it("2026-09-10(제품 오너 지적): 같은 보호자가 만든 자녀별 카드도 자녀 이름으로 구분된다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [
        { id: "link1", guardian_name: "박보호자", guardian_email: "parent@example.com" },
      ],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "자녀A", student_grade: "10학년", child_auth_user_id: "child1", created_at: "2026-01-01" },
        { id: "student-row-2", link_id: "link1", student_name: "자녀B", student_grade: "9학년", child_auth_user_id: "child2", created_at: "2026-01-01" },
      ],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(2);
    expect(cards[0].contact_name).toBe("박보호자");
    expect(cards[1].contact_name).toBe("박보호자");
    expect(cards.map((c) => c.requested_children?.[0]?.name)).toEqual(
      expect.arrayContaining(["자녀A", "자녀B"])
    );
    expect(cards.find((c) => c.child_id === "child1")?.student_grade).toBe("10학년");
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

  it("2026-09-16(실사용 중 발견) — 실제 trial_smart_notes_consents 기록이 있으면 consent_confirmed_at을 채운다(항상 null이던 결함 수정)", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "parent@example.com" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "학생1", child_auth_user_id: "child1", created_at: "2026-01-01" },
      ],
      trial_smart_notes_consents: [{ child_id: "child1", confirmed_at: "2026-09-16T18:05:28.980397+00:00" }],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(1);
    expect(cards[0].consent_confirmed_at).toBe("2026-09-16T18:05:28.980397+00:00");
  });

  it("동의 기록이 없으면 여전히 null이다(대기 배지가 정상적으로 유지됨)", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "parent@example.com" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "학생1", child_auth_user_id: "child1", created_at: "2026-01-01" },
      ],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards[0].consent_confirmed_at).toBeNull();
  });

  // 2026-09-16(제품 오너 지시 — 재설계) — 계정 생성 카드의 "완료" 판정은 상담의
  // closure_type이 아니라 contracts.status='active' 단독 기준이어야 한다(상담
  // 라이프사이클을 흉내 내지 않음). 완료 전에는 "신규 현황"에 남고, 완료되면
  // 반드시 빠져야 한다 — listClosedConsultationsAction()이 같은 기준으로
  // "신규 내역"에 합성해 넣는지는 별도 테스트(consultation-kanban-actions)에서 확인한다.
  it("계약이 아직 active가 아니면(draft 등) '신규 현황'에 남는다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "jiman@bulqot.co" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "matchbox", child_auth_user_id: "child1", created_at: "2026-01-01" },
      ],
      contracts: [],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(1);
  });

  it("계약이 active가 되면 '신규 현황'에서 빠진다(등록 완료 — 상담 라이프사이클로 옮기지 않음)", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "jiman@bulqot.co" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "matchbox", child_auth_user_id: "child1", created_at: "2026-01-01" },
      ],
      contracts: [{ child_id: "child1" }],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(0);
  });
});
