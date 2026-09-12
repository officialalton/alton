import { describe, expect, it } from "vitest";
import { loadTeacherSettlement, nextMonthKey } from "./settlement-data";

// P4-2 — 교사 정산 조회. 검증 대상은 "원장 상태 → 예정/확정/지급 완료 3분류"와
// 월 그룹핑(수업 월 = 예약 시작일 기준, 지급 예정 월 = 그 익월)이다.
// 금액은 payout_items.amount_minor를 그대로 쓰고 앱에서 재계산하지 않는다.

type Row = Record<string, unknown>;

function supabaseMock(tables: Record<string, Row[]>) {
  const callCounts: Record<string, number> = {};
  return {
    callCounts,
    client: {
      from: (table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const builder: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in", "order"]) builder[m] = () => builder;
        builder.then = (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
        return builder;
      },
    } as never,
  };
}

const BASE_TABLES = {
  sessions: [
    { id: "sess-1", reservation_id: "res-1", subject_enrollment_id: "se-1" },
    { id: "sess-2", reservation_id: "res-2", subject_enrollment_id: "se-1" },
  ],
  reservations: [
    { id: "res-1", starts_at: "2026-08-10T01:00:00.000Z" },
    { id: "res-2", starts_at: "2026-09-03T01:00:00.000Z" },
  ],
  subject_enrollments: [{ id: "se-1", child: { name: "김학생" }, subject: { name: "SAT Math" } }],
};

function item(over: Partial<Row>): Row {
  return {
    id: "item-1",
    batch_id: null,
    session_id: "sess-2",
    item_type: "regular",
    amount_minor: 50000,
    currency: "KRW",
    payable_minutes: 60,
    hourly_rate_snapshot_minor: 50000,
    status: "pending",
    ...over,
  };
}

describe("nextMonthKey", () => {
  it("연말을 넘어가면 해가 바뀐다", () => {
    expect(nextMonthKey("2026-09")).toBe("2026-10");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});

describe("loadTeacherSettlement", () => {
  it("정산 내역이 없으면 빈 결과와 null 지급 예정 월을 돌려준다", async () => {
    const { client } = supabaseMock({ payout_items: [] });
    const result = await loadTeacherSettlement(client, "t1");
    expect(result.months).toEqual([]);
    expect(result.nextPayoutMonth).toBeNull();
    expect(result.scheduledTotalsByCurrency).toEqual({});
  });

  it("배치가 없는 항목은 예정, 배치에 담기면 확정, 배치가 paid면 지급 완료로 나눈다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i-scheduled", session_id: "sess-2", batch_id: null }),
        item({ id: "i-confirmed", session_id: "sess-1", batch_id: "b-approved", amount_minor: 30000 }),
        item({ id: "i-paid", session_id: "sess-1", batch_id: "b-paid", amount_minor: 20000 }),
      ],
      payout_batches: [
        { id: "b-approved", status: "approved", paid_at: null },
        { id: "b-paid", status: "paid", paid_at: "2026-09-05T00:00:00.000Z" },
      ],
    });

    const result = await loadTeacherSettlement(client, "t1");

    expect(result.scheduledTotalsByCurrency).toEqual({ KRW: 50000 });
    expect(result.confirmedTotalsByCurrency).toEqual({ KRW: 30000 });
    expect(result.paidTotalsByCurrency).toEqual({ KRW: 20000 });
    // 예정 금액이 있는 가장 이른 수업 월(2026-09)의 익월.
    expect(result.nextPayoutMonth).toBe("2026-10");
  });

  it("수업 월로 묶고 지급 예정 월을 익월로 계산하며 수업별 산출 근거를 채운다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [item({ id: "i1", session_id: "sess-1" })],
      payout_batches: [],
    });

    const result = await loadTeacherSettlement(client, "t1");

    expect(result.months).toHaveLength(1);
    const m = result.months[0];
    expect(m.settlementMonth).toBe("2026-08");
    expect(m.payoutMonth).toBe("2026-09");
    expect(m.status).toBe("scheduled");
    expect(m.lessonCount).toBe(1);
    expect(m.lines[0]).toMatchObject({
      studentName: "김학생",
      subjectName: "SAT Math",
      payableMinutes: 60,
      amountMinor: 50000,
      currency: "KRW",
    });
  });

  it("같은 달이라도 상태가 다르면 줄을 나눠 보여준다(예정과 확정이 섞이지 않는다)", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i1", session_id: "sess-1", batch_id: null, amount_minor: 10000 }),
        item({ id: "i2", session_id: "sess-1", batch_id: "b1", amount_minor: 20000 }),
      ],
      payout_batches: [{ id: "b1", status: "approved", paid_at: null }],
    });

    const result = await loadTeacherSettlement(client, "t1");

    const august = result.months.filter((m) => m.settlementMonth === "2026-08");
    expect(august.map((m) => m.status).sort()).toEqual(["confirmed", "scheduled"]);
  });

  it("수업 수가 늘어도 조회 횟수는 고정이다(N+1 아님)", async () => {
    const { client, callCounts } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i1", session_id: "sess-1" }),
        item({ id: "i2", session_id: "sess-2" }),
        item({ id: "i3", session_id: "sess-1" }),
        item({ id: "i4", session_id: "sess-2" }),
      ],
      payout_batches: [],
    });

    await loadTeacherSettlement(client, "t1");

    expect(callCounts.payout_items).toBe(1);
    expect(callCounts.sessions).toBe(1);
    expect(callCounts.reservations).toBe(1);
    expect(callCounts.subject_enrollments).toBe(1);
  });

  it("예약 시작일을 알 수 없는 항목도 금액이 사라지지 않는다(기간 미상 버킷)", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [item({ id: "i1", session_id: null, amount_minor: 7000 })],
      payout_batches: [],
    });

    const result = await loadTeacherSettlement(client, "t1");

    expect(result.scheduledTotalsByCurrency).toEqual({ KRW: 7000 });
    expect(result.months[0].settlementMonth).toBe("unknown");
    expect(result.months[0].payoutMonth).toBe("unknown");
  });
});
