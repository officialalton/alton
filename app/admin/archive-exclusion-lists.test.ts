import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-1(B, 2026-09-11 보완) — 확정 범위인 세 목록(신규 보드 / 계정 생성 카드 /
// 발송 내역)에서도 아카이브된 가구가 빠지는지 검증한다. 학부모·학생·매칭 목록은
// app/admin/users-data-archive-filter.test.ts가 담당한다.

type QueryResult = { data: unknown; error: unknown };

const {
  adminRpcMock,
  adminFromMock,
  requireAdminOrCapabilityMock,
  listConsultationsForAdminMock,
  archivedProfileIdsMock,
} = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
  adminFromMock: vi.fn(),
  requireAdminOrCapabilityMock: vi.fn(),
  listConsultationsForAdminMock: vi.fn(),
  archivedProfileIdsMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }) }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: requireAdminOrCapabilityMock }));
vi.mock("@/lib/household/household-archive", () => ({ archivedHouseholdProfileIds: archivedProfileIdsMock }));
vi.mock("./consultation-scheduling-actions", () => ({ listConsultationsForAdmin: listConsultationsForAdminMock }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), escapeHtml: (v: string) => v }));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost:3010") }));

import { loadKanbanBoard } from "./consultation-kanban-data";
import { listDirectOnboardingLinksAction } from "./direct-account-actions";

const queues = new Map<string, QueryResult[]>();
function setQueue(table: string, results: QueryResult[]) {
  queues.set(table, [...results]);
}
function nextResult(table: string): QueryResult {
  const queue = queues.get(table);
  if (!queue || queue.length === 0) return { data: [], error: null };
  return queue.length === 1 ? queue[0] : queue.shift()!;
}
function builder(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "not", "gt", "order", "limit"]) chain[method] = () => chain;
  chain.maybeSingle = () => Promise.resolve(nextResult(table));
  chain.single = () => Promise.resolve(nextResult(table));
  chain.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
  return chain;
}

function consultationRow(id: string, childId: string | null) {
  return {
    id,
    child_id: childId,
    status: "completed",
    outcome: "regular_recommended",
    is_child_onboarding_card: false,
    contact_name: "보호자",
    contact_email: "g@example.com",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queues.clear();
  adminFromMock.mockImplementation((table: string) => builder(table));
  requireAdminOrCapabilityMock.mockResolvedValue({ actorUserId: "admin1" });
  listConsultationsForAdminMock.mockResolvedValue([]);
  archivedProfileIdsMock.mockResolvedValue(new Set<string>());
});

describe("신규 보드(loadKanbanBoard) — 아카이브 제외", () => {
  it("아카이브된 가구의 자녀 상담 카드는 보드에서 빠진다", async () => {
    listConsultationsForAdminMock.mockResolvedValue([
      consultationRow("c-active", "child-active"),
      consultationRow("c-archived", "child-archived"),
    ]);
    archivedProfileIdsMock.mockResolvedValue(new Set(["child-archived"]));

    const cards = await loadKanbanBoard({ from: adminFromMock } as never);

    expect(cards.map((c) => c.id)).toEqual(["c-active"]);
  });

  it("아카이브된 가구의 계정 생성 카드도 함께 빠진다(카드 키가 child_auth_user_id)", async () => {
    setQueue("trial_onboarding_links", [
      { data: [{ id: "l1", guardian_name: "보호자", guardian_email: "g@example.com" }], error: null },
    ]);
    setQueue("trial_onboarding_link_students", [
      {
        data: [
          { id: "s-active", link_id: "l1", student_name: "활성자녀", student_grade: null, child_auth_user_id: "child-active", created_at: "2026-09-01" },
          { id: "s-archived", link_id: "l1", student_name: "아카이브자녀", student_grade: null, child_auth_user_id: "child-archived", created_at: "2026-09-02" },
        ],
        error: null,
      },
    ]);
    archivedProfileIdsMock.mockResolvedValue(new Set(["child-archived"]));

    const cards = await loadKanbanBoard({ from: adminFromMock } as never);

    expect(cards.map((c) => c.id)).toEqual(["link:s-active"]);
  });

  it("아카이브된 가구가 없으면 모든 카드를 그대로 보여준다", async () => {
    listConsultationsForAdminMock.mockResolvedValue([consultationRow("c1", "child-1")]);
    const cards = await loadKanbanBoard({ from: adminFromMock } as never);
    expect(cards.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("발송 내역(listDirectOnboardingLinksAction) — 아카이브 제외", () => {
  function arrangeLinks() {
    setQueue("trial_onboarding_links", [
      {
        data: [
          { id: "l-active", guardian_email: "a@example.com", guardian_name: "활성보호자", status: "redeemed", notice_delivery_status: "sent", notice_sent_at: "2026-09-01", created_at: "2026-09-01", redeemed_auth_user_id: "guardian-active" },
          { id: "l-archived", guardian_email: "b@example.com", guardian_name: "아카이브보호자", status: "redeemed", notice_delivery_status: "sent", notice_sent_at: "2026-09-02", created_at: "2026-09-02", redeemed_auth_user_id: "guardian-archived" },
        ],
        error: null,
      },
    ]);
    setQueue("trial_onboarding_link_students", [
      {
        data: [
          { link_id: "l-active", status: "created", child_auth_user_id: "child-active" },
          { link_id: "l-archived", status: "created", child_auth_user_id: "child-archived" },
        ],
        error: null,
      },
    ]);
  }

  it("아카이브된 보호자의 발송 건은 목록에서 빠진다", async () => {
    arrangeLinks();
    archivedProfileIdsMock.mockResolvedValue(new Set(["guardian-archived", "child-archived"]));

    const result = await listDirectOnboardingLinksAction();

    expect(result.map((l) => l.linkId)).toEqual(["l-active"]);
  });

  it("보호자 계정은 아직 연결 전이어도 만들어진 자녀가 아카이브면 뺀다", async () => {
    arrangeLinks();
    archivedProfileIdsMock.mockResolvedValue(new Set(["child-archived"]));

    const result = await listDirectOnboardingLinksAction();

    expect(result.map((l) => l.linkId)).toEqual(["l-active"]);
  });

  it("아카이브된 가구가 없으면 발송 건을 전부 보여준다", async () => {
    arrangeLinks();
    const result = await listDirectOnboardingLinksAction();
    expect(result.map((l) => l.linkId)).toEqual(["l-active", "l-archived"]);
  });
});
