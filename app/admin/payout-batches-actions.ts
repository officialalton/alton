"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { loadPayoutBatches, type PayoutBatchListItem } from "./payout-batches-data";

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

// P4-2(UAT 후속) — 목록을 클라이언트에서 직접 조회한다.
// 기존에는 SSR이 내려준 initialBatches를 useState 초기값으로만 썼는데, 관리자 탭
// 전환이 클라이언트 라우팅이라 탭을 처음 열 때 빈 배열을 잡고 그대로 굳었다
// (= "Batch 생성 후 나갔다 다시 들어오면 목록이 비어 보인다"는 실제 버그).
export async function listPayoutBatchesAction(): Promise<PayoutBatchListItem[]> {
  const { supabase } = await requireAdmin();
  return loadPayoutBatches(supabase);
}

// P4-2(UAT 후속) — 잘못된 기간으로 마감했을 때 되돌릴 수 있게 한다.
// 승인 전(검토 단계)만 허용하고, 관리자 조정이 붙은 묶음은 거부한다(조정 이력은
// INSERT-only 감사 기록이라 지울 수 없다). 항목은 삭제하지 않고 미배치로 되돌린다.
export type DeletePayoutBatchResult = { status: "deleted" } | { status: "rejected"; error: string };

export async function deletePayoutBatch(batchId: string): Promise<DeletePayoutBatchResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_payout_batch", {
    p_batch_id: batchId,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "deleted" };
}

// =========================================================================
// P4-2 — 지급 예정일 / 자동 송금 / 지금 송금 요청 / 외부 송금 완료 기록
// =========================================================================

export type PayoutActionResult = { status: "ok" } | { status: "rejected"; error: string };

/** 관리자만 지급 예정일을 바꾼다. 변경 전후·사유·처리자·시각은 DB가 이력으로 남긴다. */
export async function setPayoutBatchScheduledDate(params: {
  batchId: string;
  newDate: string;
  reason: string;
}): Promise<PayoutActionResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_payout_batch_scheduled_date", {
    p_batch_id: params.batchId,
    p_new_date: params.newDate,
    p_reason: params.reason,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "ok" };
}

export async function setPayoutBatchAutoDispatch(batchId: string, enabled: boolean): Promise<PayoutActionResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_payout_batch_auto_dispatch", {
    p_batch_id: batchId,
    p_enabled: enabled,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "ok" };
}

export async function getAutoDispatchEnabled(): Promise<boolean> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payout_auto_dispatch_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.enabled);
}

export async function setAutoDispatchEnabled(enabled: boolean): Promise<PayoutActionResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_auto_dispatch_enabled", {
    p_enabled: enabled,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "ok" };
}

// 지금 송금 요청 — 자동 예정일을 기다리지 않고 송금 경로로 넘긴다.
// 실제 송금 여부는 DB의 real_disbursement_enabled() 게이트가 결정한다. 게이트가
// 닫혀 있으면 dispatch_payout_batch()가 예외를 던지고, 그 사유가 그대로 화면에 뜬다
// (이 액션이 게이트를 우회하거나 성공한 척하지 않는다).
// 제공자는 받지 않는다 — 교사 정산은 Wise 전용이다(TEACHER_PAYOUT_PROVIDER).
// 자동 실행과 수동 실행이 같은 서비스·같은 멱등성 키(dispatch_idempotency_key)를 쓴다.
export async function dispatchPayoutBatchNow(batchId: string): Promise<PayoutActionResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { TEACHER_PAYOUT_PROVIDER } = await import("@/lib/payout/auto-dispatch");
  const { error } = await admin.rpc("dispatch_payout_batch", {
    p_batch_id: batchId,
    p_provider: TEACHER_PAYOUT_PROVIDER,
    p_requested_by: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "ok" };
}

// 외부 송금 완료 기록 — 은행에서 직접 보낸 건을 기록만 한다(금융 API 호출 없음).
export async function recordExternalPayoutTransfer(params: {
  batchId: string;
  transferredOn: string;
  amountMinor: number;
  currency: string;
  /** 송금 확인 메모(선택). 이체확인증 번호·은행 거래 ID·내부 전표 번호 등 사후 대사 보조 정보. */
  bankReference?: string;
  memo?: string;
}): Promise<PayoutActionResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_external_payout_transfer", {
    p_batch_id: params.batchId,
    p_transferred_on: params.transferredOn,
    p_amount_minor: params.amountMinor,
    p_currency: params.currency,
    p_bank_reference: params.bankReference ?? null,
    p_memo: params.memo ?? null,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "ok" };
}

/** 지급 경계(real_disbursement_enabled) 상태 — 화면이 "지금 송금 요청"을 실행 버튼처럼
 *  보여줄지, 비활성 안내로 보여줄지 판단하는 데 쓴다. */
export async function getDisbursementGateEnabled(): Promise<boolean> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("real_disbursement_enabled");
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** 승인됐는데 지급 예정일이 비어 있는 묶음(도입 전 승인 건 등)을 안전하게 채운다. */
export async function ensurePayoutBatchScheduledDate(batchId: string): Promise<PayoutActionResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("ensure_payout_batch_scheduled_date", {
    p_batch_id: batchId,
    p_actor_id: adminUserId,
  });
  if (error) return { status: "rejected", error: error.message };
  return { status: "ok" };
}
