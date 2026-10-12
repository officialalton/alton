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
      gt: () => builder,
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
      if (table === "trial_onboarding_links") {
        // 2026-10-12 — 같은 테이블을 두 로더가 읽는다: 계정 생성 카드(notice 컬럼 없음)와
        // "계정 생성 대기"(notice_delivery_status 포함). select 컬럼으로 구분해 각자 행을 돌려준다.
        const result = (rows: Row[]) => chain(rows);
        return {
          select: (cols: string) =>
            cols.includes("notice_delivery_status")
              ? result(tables.pending_links ?? [])
              : result(tables.trial_onboarding_links ?? []),
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
    // 계정 생성 카드 1회 + 계정 생성 대기 카드 1회(2026-10-12). 대기 링크가 없으면 학생 조회는 추가되지 않는다.
    expect(admin.callCounts.trial_onboarding_links).toBe(2);
    expect(admin.callCounts.trial_onboarding_link_students).toBe(1);
  });

  it("2026-09-29(6단계) — 체험 Smart Notes 동의는 폐지됐으므로 trial_smart_notes_consents를 조회하지 않고 consent_confirmed_at은 항상 null이다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [{ id: "link1", guardian_name: "박보호자", guardian_email: "parent@example.com" }],
      trial_onboarding_link_students: [
        { id: "student-row-1", link_id: "link1", student_name: "학생1", child_auth_user_id: "child1", created_at: "2026-01-01" },
      ],
      // 과거 데이터가 남아 있어도 읽지 않는다.
      trial_smart_notes_consents: [{ child_id: "child1", confirmed_at: "2026-09-16T18:05:28.980397+00:00" }],
    });

    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(1);
    expect(cards[0].consent_confirmed_at).toBeNull();
    expect(admin.callCounts.trial_smart_notes_consents ?? 0).toBe(0);
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

  it("2026-10-09 — 칸반은 일정 미정(starts_at null) 상담도 읽도록 includeUnscheduled로 조회한다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({ trial_onboarding_links: [] });
    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    await loadKanbanBoard(admin as never);
    expect(listConsultationsMock).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ includeUnscheduled: true }));
  });

  it("2026-10-09 — outcome='closed'(closure_type 없음)는 체험 신청이 아니라 상담 일정 확정에 남는다", async () => {
    listConsultationsMock.mockResolvedValue([
      { id: "c9", contact_name: "종료", contact_email: "x@example.com", status: "completed", outcome: "closed", child_id: null, is_child_onboarding_card: false },
    ]);
    const admin = makeAdminMock({ trial_onboarding_links: [] });
    const { loadKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);
    expect(cards[0].stage).toBe("scheduled");
  });

  it("2026-10-12 — 발송됐지만 열지 않은 링크는 계정 생성 대기 카드(보드 컬럼 밖)로 붙고, 학생이 이미 생성된 링크는 제외된다", async () => {
    listConsultationsMock.mockResolvedValue([]);
    const admin = makeAdminMock({
      trial_onboarding_links: [],
      pending_links: [
        { id: "pl1", guardian_name: "대기보호자", guardian_email: "w@example.com", notice_delivery_status: "sent", notice_sent_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
        { id: "pl2", guardian_name: "생성됨", guardian_email: "c@example.com", notice_delivery_status: "sent", notice_sent_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
      ],
      trial_onboarding_link_students: [
        { id: "s1", link_id: "pl1", student_name: "자녀A", student_grade: "9학년", status: "pending" },
        { id: "s2", link_id: "pl1", student_name: "취소됨", status: "cancelled" },
        { id: "s3", link_id: "pl2", student_name: "자녀B", status: "created" },
      ],
    });

    const { loadKanbanBoard, loadMyKanbanBoard } = await import("./consultation-kanban-data");
    const cards = await loadKanbanBoard(admin as never);

    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("pending-link:pl1");
    expect(cards[0].pendingAccountLink).toMatchObject({ linkId: "pl1", noticeDeliveryStatus: "sent", studentCount: 1 });
    expect(cards[0].requested_children?.map((c) => c.name)).toEqual(["자녀A"]);
    expect(cards[0].child_id).toBeNull();
    expect(admin.insertCalls).toHaveLength(0);

    // 컨설턴트 보드에는 나오지 않는다.
    const mine = await loadMyKanbanBoard(admin as never, "consultant-1");
    expect(mine.find((c) => c.pendingAccountLink)).toBeUndefined();
  });
});
