import { describe, expect, it } from "vitest";
import { loadTeacherSettlement, nextMonthKey, settlementStatusOf } from "./settlement-data";

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
    { id: "sess-3", reservation_id: "res-3", subject_enrollment_id: "se-1" },
  ],
  reservations: [
    { id: "res-1", starts_at: "2026-08-10T01:00:00.000Z" },
    { id: "res-2", starts_at: "2026-09-03T01:00:00.000Z" },
    { id: "res-3", starts_at: "2026-10-03T01:00:00.000Z" },
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

// 기한 판단은 "지금"에 따라 달라지므로 시각을 고정한다. EARLY: 모든 기한 이전(기존 의미 유지).
const EARLY = new Date("2026-08-01T12:00:00Z");

describe("nextMonthKey", () => {
  it("연말을 넘어가면 해가 바뀐다", () => {
    expect(nextMonthKey("2026-09")).toBe("2026-10");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});

describe("settlementStatusOf — DB 배치 상태 → 교사 4단계 매핑", () => {
  it("정산 묶음이 없으면 예정이다(월 마감 전)", () => {
    expect(settlementStatusOf(null, "pending")).toBe("scheduled");
  });

  // 2026-09-12 제품 오너 지시: 묶음이 생긴 것만으로 교사 화면이 '검토 중'이 되면 안 된다.
  // 관리자가 '검토 제출'을 눌러야 검토 중이다.
  it("묶음이 만들어지기만 한 상태(draft/calculated)는 아직 '예정'이다", () => {
    for (const s of ["draft", "calculated"]) {
      expect(settlementStatusOf(s, "batched")).toBe("scheduled");
    }
  });

  it("검토 제출 이후(reviewing/reviewed)부터 '검토 중'이다", () => {
    for (const s of ["reviewing", "reviewed"]) {
      expect(settlementStatusOf(s, "batched")).toBe("in_review");
    }
  });

  it("실행이 실패해 관리자에게 되돌아온 묶음도 검토 중으로 보여준다", () => {
    expect(settlementStatusOf("failed", "batched")).toBe("in_review");
  });

  it("승인 이후의 실행 단계는 교사에게 '송금 승인됨' 하나로 묶는다", () => {
    for (const s of ["approved", "dispatch_requested", "provider_pending", "processing"]) {
      expect(settlementStatusOf(s, "batched")).toBe("approved");
    }
  });

  it("지급 완료는 배치 또는 항목 어느 쪽 기준으로도 잡는다", () => {
    expect(settlementStatusOf("paid", "batched")).toBe("paid");
    expect(settlementStatusOf("approved", "paid")).toBe("paid");
  });
});

describe("loadTeacherSettlement", () => {
  it("정산 내역이 없으면 빈 결과와 null 지급 예정 월을 돌려준다", async () => {
    const { client } = supabaseMock({ payout_items: [] });
    const result = await loadTeacherSettlement(client, "t1", EARLY);
    expect(result.months).toEqual([]);
    expect(result.nextPayoutMonth).toBeNull();
    expect(result.scheduledTotalsByCurrency).toEqual({});
    expect(result.inReviewTotalsByCurrency).toEqual({});
    expect(result.approvedTotalsByCurrency).toEqual({});
  });

  it("예정·검토 중·송금 승인됨·지급 완료 4단계로 나눈다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i-scheduled", session_id: "sess-2", batch_id: null }),
        item({ id: "i-review", session_id: "sess-1", batch_id: "b-calculated", amount_minor: 10000 }),
        item({ id: "i-approved", session_id: "sess-1", batch_id: "b-approved", amount_minor: 30000 }),
        item({ id: "i-paid", session_id: "sess-1", batch_id: "b-paid", amount_minor: 20000 }),
      ],
      payout_batches: [
        { id: "b-calculated", status: "reviewing", paid_at: null },
        { id: "b-approved", status: "approved", paid_at: null },
        { id: "b-paid", status: "paid", paid_at: "2026-09-05T00:00:00.000Z" },
      ],
    });

    const result = await loadTeacherSettlement(client, "t1", EARLY);

    expect(result.scheduledTotalsByCurrency).toEqual({ KRW: 50000 });
    expect(result.inReviewTotalsByCurrency).toEqual({ KRW: 10000 });
    expect(result.approvedTotalsByCurrency).toEqual({ KRW: 30000 });
    expect(result.paidTotalsByCurrency).toEqual({ KRW: 20000 });
    // 예정 금액이 있는 가장 이른 정산 기간(2026-09-01~15, LA 기준)의 지급일(9/26 토요일 → 9/25).
    expect(result.nextPayoutDate).toBe("2026-09-25"); // 26일 토요일 → 직전 영업일
    expect(result.nextPayoutMonth).toBe("2026-09");
  });

  it("반월 정산 기간으로 묶고 지급 기한(26일/10일)을 계산하며 수업별 산출 근거를 채운다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [item({ id: "i1", session_id: "sess-1" })],
      payout_batches: [],
    });

    const result = await loadTeacherSettlement(client, "t1", EARLY);

    expect(result.months).toHaveLength(1);
    const m = result.months[0];
    expect(m.settlementMonth).toBe("2026-08");
    expect(m.periodKey).toBe("2026-08-H1");
    expect(m.periodStart).toBe("2026-08-01");
    expect(m.periodEnd).toBe("2026-08-15");
    expect(m.nominalPayoutDate).toBe("2026-08-26");
    expect(m.payoutMonth).toBe("2026-08");
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

  it("같은 달이라도 상태가 다르면 줄을 나눠 보여준다(예정과 송금 승인됨이 섞이지 않는다)", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i1", session_id: "sess-1", batch_id: null, amount_minor: 10000 }),
        item({ id: "i2", session_id: "sess-1", batch_id: "b1", amount_minor: 20000 }),
      ],
      payout_batches: [{ id: "b1", status: "approved", paid_at: null }],
    });

    const result = await loadTeacherSettlement(client, "t1", EARLY);

    const august = result.months.filter((m) => m.settlementMonth === "2026-08");
    expect(august.map((m) => m.status).sort()).toEqual(["approved", "scheduled"]);
  });

  it("자동 산정 수업 합계와 관리자 조정액을 분리해 집계한다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i1", session_id: "sess-1", batch_id: "b1", amount_minor: 60000 }),
        // 조정 항목은 세션에 매이지 않는다(session_id null).
        item({
          id: "adj1",
          session_id: null,
          batch_id: "b1",
          item_type: "adjustment",
          amount_minor: -10000,
          payable_minutes: 0,
          created_at: "2026-08-12T00:00:00.000Z",
        }),
      ],
      payout_batches: [{ id: "b1", status: "reviewed", paid_at: null }],
      payout_batch_adjustments: [
        {
          id: "a1",
          batch_id: "b1",
          amount_minor: -10000,
          currency: "KRW",
          reason: "교통비 차감",
          created_at: "2026-08-12T00:00:00.000Z",
        },
      ],
    });

    const result = await loadTeacherSettlement(client, "t1", EARLY);
    const august = result.months.find((m) => m.settlementMonth === "2026-08")!;

    expect(august.autoCalculatedAmountMinor).toBe(60000);
    expect(august.adjustmentAmountMinor).toBe(-10000);
    expect(august.totalAmountMinor).toBe(50000);
    // 조정 항목은 수업 건수에 들어가지 않는다.
    expect(august.lessonCount).toBe(1);
    expect(august.lines).toHaveLength(1);
    // 조정 사유는 교사에게도 보인다.
    expect(august.adjustments).toEqual([
      {
        id: "a1",
        amountMinor: -10000,
        currency: "KRW",
        reason: "교통비 차감",
        createdAt: "2026-08-12T00:00:00.000Z",
      },
    ]);
  });

  it("아직 묶이지 않은 이월 조정 항목은 발생한 달로 묶어 보여준다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({
          id: "carry",
          session_id: null,
          batch_id: null,
          item_type: "adjustment",
          amount_minor: -30000,
          payable_minutes: 0,
          created_at: "2026-09-15T00:00:00.000Z",
        }),
      ],
      payout_batches: [],
    });

    const result = await loadTeacherSettlement(client, "t1", EARLY);

    expect(result.months).toHaveLength(1);
    expect(result.months[0]).toMatchObject({
      settlementMonth: "2026-09",
      payoutMonth: "2026-09",
      status: "scheduled",
      adjustmentAmountMinor: -30000,
      autoCalculatedAmountMinor: 0,
      lessonCount: 0,
    });
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

    await loadTeacherSettlement(client, "t1", EARLY);

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

    const result = await loadTeacherSettlement(client, "t1", EARLY);

    expect(result.scheduledTotalsByCurrency).toEqual({ KRW: 7000 });
    expect(result.months[0].settlementMonth).toBe("unknown");
    expect(result.months[0].payoutMonth).toBe("unknown");
  });
});

describe("loadTeacherSettlement — 기한이 지난 건은 '다음 지급'이 아니다", () => {
  const OCT7 = new Date("2026-10-07T17:00:00Z"); // LA 10월 7일

  it("배치 없는 옛 예정 건(기한 9/25 경과)은 다음 지급에서 빠지고 '기한 경과' 합계로 분리된다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [item({ id: "i-old", session_id: "sess-2", batch_id: null, amount_minor: 70000 })],
      payout_batches: [],
    });
    const r = await loadTeacherSettlement(client, "t1", OCT7);
    expect(r.scheduledTotalsByCurrency).toEqual({});
    expect(r.overdueTotalsByCurrency).toEqual({ KRW: 70000 });
    expect(r.overdueSince).toBe("2026-09-25");
    expect(r.nextPayoutDate).toBeNull();
    expect(r.months[0]).toMatchObject({ overdue: true, effectiveDeadline: "2026-09-25" });
  });

  it("검토 중·승인된 묶음도 기한이 지났으면 overdue 표시(금액은 각자 카드에 남는다). 다음 기한은 예정 금액과 짝이라 예정 건이 없으면 null", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i-rev", session_id: "sess-2", batch_id: "b-rev", amount_minor: 10000 }),
        item({ id: "i-fut", session_id: "sess-1", batch_id: "b-fut", amount_minor: 20000 }),
      ],
      payout_batches: [
        { id: "b-rev", status: "reviewing", paid_at: null, scheduled_payout_date: "2026-09-25" },
        { id: "b-fut", status: "approved", paid_at: null, scheduled_payout_date: "2026-10-26" },
      ],
    });
    const r = await loadTeacherSettlement(client, "t1", OCT7);
    expect(r.inReviewTotalsByCurrency).toEqual({ KRW: 10000 });
    expect(r.approvedTotalsByCurrency).toEqual({ KRW: 20000 });
    expect(r.months.find((m) => m.status === "in_review")?.overdue).toBe(true);
    expect(r.months.find((m) => m.status === "approved")?.overdue).toBe(false);
    expect(r.nextPayoutDate).toBeNull();
  });

  it("기한이 지난 건과 미래 기한 건이 섞이면 다음 기한은 미래 것이다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [
        item({ id: "i-old", session_id: "sess-2", batch_id: null, amount_minor: 70000 }),
        item({ id: "i-new", session_id: "sess-3", batch_id: null, amount_minor: 30000 }),
      ],
      payout_batches: [],
    });
    const r = await loadTeacherSettlement(client, "t1", OCT7);
    expect(r.overdueTotalsByCurrency).toEqual({ KRW: 70000 });
    expect(r.scheduledTotalsByCurrency).toEqual({ KRW: 30000 });
    expect(r.nextPayoutDate).toBe("2026-10-26");
  });

  it("지급 완료 건은 기한이 지나도 overdue가 아니다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [item({ id: "i-paid", session_id: "sess-2", batch_id: "b-paid", amount_minor: 5000 })],
      payout_batches: [{ id: "b-paid", status: "paid", paid_at: "2026-09-26T00:00:00Z", scheduled_payout_date: "2026-09-25" }],
    });
    const r = await loadTeacherSettlement(client, "t1", OCT7);
    expect(r.overdueTotalsByCurrency).toEqual({});
    expect(r.months[0].overdue).toBe(false);
  });

  it("기한 당일(LA 날짜)은 아직 경과가 아니다", async () => {
    const { client } = supabaseMock({
      ...BASE_TABLES,
      payout_items: [item({ id: "i-today", session_id: "sess-2", batch_id: null, amount_minor: 1000 })],
      payout_batches: [],
    });
    const r = await loadTeacherSettlement(client, "t1", new Date("2026-09-25T20:00:00Z"));
    expect(r.overdueTotalsByCurrency).toEqual({});
    expect(r.nextPayoutDate).toBe("2026-09-25");
  });
});
