// P4-2(2차) — 자동 정산 마감(2026-10-06부터 월 2회: 매월 1일·16일 실행).
//
// 확정 흐름: 정산 대상 월이 끝나면 시스템이 그 달의 정산 항목을 월별 묶음으로
// 자동 생성한다(= 검토 중 진입). 관리자가 기간을 넣어 실행하는 기존 경로
// (generate_payout_batches, app/admin/PayoutBatchesTab.tsx)는 **운영 보조 수단**으로
// 남기고, 정상 경로는 이 자동 마감이다.
//
// 날짜 기준: 회사 시간대 America/Los_Angeles 달력 날짜(payout-schedule.ts). DB의
// close_payout_period()도 starts_at을 LA 날짜로 환산한다(20262100000046).
//
// 멱등성: 실제 중복 방지는 DB의 close_payout_period()가 담당한다(기간 advisory
// lock + 후보 항목 FOR UPDATE SKIP LOCKED + 열린 묶음 재사용). 이 모듈은 "어느
// 기간을 마감할지" 계산과 호출만 한다.

import { createAdminClient } from "@/lib/supabase-admin";
import { previousPayoutPeriod } from "./payout-schedule";

export type ClosedBatchSummary = {
  batchId: string;
  teacherId: string;
  currency: string;
  itemCount: number;
  totalAmountMinor: number;
};

export async function closePayoutPeriod(params: {
  periodStart: string;
  periodEnd: string;
  /** true면 기간 시작일 이전의 미배치 항목도 쓸어 담는다(크론 catch-up). 관리자 수동 실행은 false. */
  includeEarlier?: boolean;
}): Promise<ClosedBatchSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("close_payout_period", {
    p_period_start: params.periodStart,
    p_period_end: params.periodEnd,
    p_include_earlier: params.includeEarlier ?? false,
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

/** 크론 진입점이 쓰는 기본 동작: 직전에 끝난 정산 기간(월 2회: 1~15일 / 16일~말일)을 마감한다. */
export async function closePreviousPeriod(now: Date = new Date()): Promise<{
  periodStart: string;
  periodEnd: string;
  batches: ClosedBatchSummary[];
}> {
  const { periodStart, periodEnd } = previousPayoutPeriod(now);
  const batches = await closePayoutPeriod({ periodStart, periodEnd, includeEarlier: true });
  return { periodStart, periodEnd, batches };
}
