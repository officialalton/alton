// P4-2(2차) — 자동 월 마감.
//
// 확정 흐름: 정산 대상 월이 끝나면 시스템이 그 달의 정산 항목을 월별 묶음으로
// 자동 생성한다(= 검토 중 진입). 관리자가 기간을 넣어 실행하는 기존 경로
// (generate_payout_batches, app/admin/PayoutBatchesTab.tsx)는 **운영 보조 수단**으로
// 남기고, 정상 경로는 이 자동 마감이다.
//
// 날짜 기준: 기존 정산과 동일한 **UTC**. generate_payout_batches()가
// `reservations.starts_at::date`(DB 타임존 UTC)로 기간을 잘라왔고
// payouts-data.ts의 previousMonthRange()도 UTC였다 — 여기서 기준을 바꾸면 월 경계
// 수업이 다른 달로 재분류되므로 일관성을 위해 UTC를 유지한다.
//
// 멱등성: 실제 중복 방지는 DB의 close_payout_period()가 담당한다(기간 advisory
// lock + 후보 항목 FOR UPDATE SKIP LOCKED + 열린 묶음 재사용). 이 모듈은 "어느
// 기간을 마감할지" 계산과 호출만 한다.

import { createAdminClient } from "@/lib/supabase-admin";

export type ClosedBatchSummary = {
  batchId: string;
  teacherId: string;
  currency: string;
  itemCount: number;
  totalAmountMinor: number;
};

/** 주어진 시각(기본: 지금) 기준으로 "직전에 끝난 달"의 UTC 기간을 돌려준다. */
export function previousUtcMonthRange(now: Date = new Date()): { periodStart: string; periodEnd: string } {
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(
    Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1)
  );
  return {
    periodStart: firstOfPrevMonth.toISOString().slice(0, 10),
    periodEnd: lastOfPrevMonth.toISOString().slice(0, 10),
  };
}

export async function closePayoutPeriod(params: {
  periodStart: string;
  periodEnd: string;
}): Promise<ClosedBatchSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("close_payout_period", {
    p_period_start: params.periodStart,
    p_period_end: params.periodEnd,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    batchId: row.batch_id as string,
    teacherId: row.out_teacher_id as string,
    currency: row.currency as string,
    itemCount: Number(row.item_count ?? 0),
    totalAmountMinor: Number(row.total_amount_minor ?? 0),
  }));
}

/** 크론 진입점이 쓰는 기본 동작: 직전에 끝난 달을 마감한다. */
export async function closePreviousMonth(now: Date = new Date()): Promise<{
  periodStart: string;
  periodEnd: string;
  batches: ClosedBatchSummary[];
}> {
  const { periodStart, periodEnd } = previousUtcMonthRange(now);
  const batches = await closePayoutPeriod({ periodStart, periodEnd });
  return { periodStart, periodEnd, batches };
}
