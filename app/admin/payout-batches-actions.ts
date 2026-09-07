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
