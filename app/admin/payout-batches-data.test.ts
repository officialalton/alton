import { describe, expect, it, vi } from "vitest";
import { loadPayoutBatches } from "./payout-batches-data";

// R10 Task C (2026-09-07) — payout_batches/payout_items/payout_batch_audit_log를
// 조인해 관리자 화면용 모양으로 펼치는 읽기 전용 로더 테스트.
function buildSupabaseMock({
  batches,
  profiles,
  items,
  auditRows,
}: {
  batches: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  items: Record<string, unknown>[];
  auditRows: Record<string, unknown>[];
}) {
  const from = vi.fn((table: string) => {
    if (table === "payout_batches") {
      return {
        select: () => ({
          order: () => Promise.resolve({ data: batches }),
        }),
      };
    }
    if (table === "profiles") {
      return { select: () => ({ in: () => Promise.resolve({ data: profiles }) }) };
    }
    if (table === "payout_items") {
      return { select: () => ({ in: () => Promise.resolve({ data: items }) }) };
    }
    if (table === "payout_batch_audit_log") {
      return {
        select: () => ({
          in: () => ({ order: () => Promise.resolve({ data: auditRows }) }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from } as unknown as Parameters<typeof loadPayoutBatches>[0];
}

describe("loadPayoutBatches", () => {
  it("batch가 없으면 빈 배열을 반환한다", async () => {
    const supabase = buildSupabaseMock({ batches: [], profiles: [], items: [], auditRows: [] });
    await expect(loadPayoutBatches(supabase)).resolves.toEqual([]);
  });

  it("batch/item/audit-log를 조합해 총액·건수·이름을 계산한다", async () => {
    const supabase = buildSupabaseMock({
      batches: [
        {
          id: "b1",
          teacher_id: "t1",
          period_start: "2026-08-01",
          period_end: "2026-08-31",
          currency: "KRW",
          status: "reviewing",
          created_at: "2026-09-01T00:00:00Z",
          approved_at: null,
          paid_at: null,
          failure_reason: null,
        },
      ],
      profiles: [{ id: "t1", name: "박서연" }],
      items: [
        { id: "i1", batch_id: "b1", item_type: "session", amount_minor: 50000, currency: "KRW", payable_minutes: 60, status: "calculated" },
        { id: "i2", batch_id: "b1", item_type: "session", amount_minor: 25000, currency: "KRW", payable_minutes: 30, status: "calculated" },
      ],
      auditRows: [
        { id: "a1", batch_id: "b1", action: "submitted_for_review", actor_id: "t1", note: null, created_at: "2026-09-02T00:00:00Z" },
      ],
    });

    const result = await loadPayoutBatches(supabase);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "b1",
      teacherName: "박서연",
      status: "reviewing",
      totalAmountMinor: 75000,
      itemCount: 2,
    });
    expect(result[0].auditLog).toEqual([
      { id: "a1", action: "submitted_for_review", actorName: "박서연", note: null, createdAt: "2026-09-02T00:00:00Z" },
    ]);
  });

  it("profiles에 없는 teacher/actor는 '알 수 없음'으로 표시한다", async () => {
    const supabase = buildSupabaseMock({
      batches: [
        {
          id: "b1",
          teacher_id: "ghost",
          period_start: "2026-08-01",
          period_end: "2026-08-31",
          currency: "KRW",
          status: "draft",
          created_at: "2026-09-01T00:00:00Z",
          approved_at: null,
          paid_at: null,
          failure_reason: null,
        },
      ],
      profiles: [],
      items: [],
      auditRows: [{ id: "a1", batch_id: "b1", action: "created", actor_id: "ghost", note: null, created_at: "2026-09-01T00:00:00Z" }],
    });

    const result = await loadPayoutBatches(supabase);
    expect(result[0].teacherName).toBe("알 수 없음");
    expect(result[0].auditLog[0].actorName).toBe("알 수 없음");
  });
});
