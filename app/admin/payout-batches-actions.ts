"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// R10 Task C — v3 payout_batches 상태 전이 서버 액션.
//
// 의도적으로 여기 없는 것들(법인 설립 전 지급 경계, 2026-09-07 정책):
// - mark_payout_batch_processing / mark_payout_batch_paid / dispatch_payout_batch /
//   mark_payout_batch_provider_pending 은 호출하지 않는다. DB의
//   real_disbursement_enabled() 게이트(기본 false)가 어차피 exception을 던지지만,
//   "UI가 DB 레이어가 거부할 액션을 아예 제공하지 않는다"는 요구사항에 따라
//   서버 액션 자체를 만들지 않았다 — 실수로 버튼을 노출해도 호출할 함수가 없다.
// - 실제 Mercury/Wise 등 provider dispatch 코드는 레포 전체에 없다.

export async function generatePayoutBatches(periodStart: string, periodEnd: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("generate_payout_batches", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_teacher_id: null,
  });
  if (error) throw new Error(error.message);
  return { created: data?.length ?? 0 };
}

export async function submitPayoutBatchForReview(batchId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_payout_batch_for_review", { p_batch_id: batchId });
  if (error) throw new Error(error.message);
}

export async function approvePayoutBatch(batchId: string) {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_payout_batch", {
    p_batch_id: batchId,
    p_approved_by: adminUserId,
  });
  if (error) throw new Error(error.message);
}

export async function markPayoutBatchFailed(batchId: string, reason: string) {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("mark_payout_batch_failed", {
    p_batch_id: batchId,
    p_reason: reason,
    p_actor_id: adminUserId,
  });
  if (error) throw new Error(error.message);
}

export async function checkRealDisbursementEnabled(): Promise<boolean> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("real_disbursement_enabled");
  if (error) return false;
  return !!data;
}

// =========================================================================
// P4-2(2차, 2026-09-12) — 최종 송금액 가감 조정 / 자동 월 마감 수동 실행
// =========================================================================
// 확정 정책: 시스템 자동 산정액은 **초기 기준값**이고, 관리자는 송금 전 최종
// 금액을 조정할 수 있다. 단 수업별 payout_items 금액과 자동 산정 근거를 직접
// 수정·덮어쓰지 않고 **별도 가감 조정 항목**으로만 처리한다 — 그 규칙은
// add_payout_batch_adjustment() RPC 안에 있고 여기서는 호출만 한다.
//
// 허용 시점도 RPC가 강제한다: 검토 중에는 그대로, 승인 뒤 송금 요청 전이면
// 묶음을 검토 중으로 되돌리고 재승인을 요구하며, 송금 요청 이후에는 거부한다.

export type AdjustPayoutBatchResult =
  | { status: "adjusted"; adjustmentId: string }
  | { status: "rejected"; error: string };

export async function adjustPayoutBatchAmount(params: {
  batchId: string;
  amountMinor: number;
  reason: string;
}): Promise<AdjustPayoutBatchResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("add_payout_batch_adjustment", {
    p_batch_id: params.batchId,
    p_amount_minor: params.amountMinor,
    p_reason: params.reason,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "adjusted", adjustmentId: data as string };
}

// 자동 월 마감과 **같은 경로**를 관리자가 수동으로 한 번 더 돌릴 수 있게 한다
// (크론 지연·일시 장애 대비). 멱등성은 close_payout_period()가 보장하므로
// 여러 번 눌러도 같은 항목이 두 번 묶이지 않는다.
export async function closePayoutMonthNow(periodStart: string, periodEnd: string) {
  await requireAdmin();
  const { closePayoutPeriod } = await import("@/lib/payout/close-payout-month");
  const batches = await closePayoutPeriod({ periodStart, periodEnd });
  return { closed: batches.length, itemCount: batches.reduce((n, b) => n + b.itemCount, 0) };
}
