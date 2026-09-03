"use server";

import { requireAdmin, requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  loadPurchaseDetail,
  loadOpenOrRecentPaymentDisputes,
  type PurchaseDetailItem,
  type PaymentDisputeItem,
} from "./entitlement-data";

// R4 — entitlement_ledger(R1: hold/consume/release) + entitlement_ledger(R4:
// refund/expire/extend/transfer/adjust) SQL 함수 위의 앱 레이어 서버 액션
// 경계. 스키마 소스 오브 트루스는 supabase/migrations/20260830050000_r1_entitlement.sql
// (hold/consume/release, entitlement_balances 뷰)과
// supabase/migrations/20260922000000_r4_purchase_and_payment.sql(나머지 전부).
//
// 관리자/결제 관련 admin capability는 R4 마이그레이션 §9에서 확정된
// 'manage_payments'를 그대로 재사용한다(신규 capability 아님 — RLS가 이미
// is_admin() OR current_user_has_capability('manage_payments')로 게이트돼 있음).
const PAYMENTS_CAPABILITY = "manage_payments";

// 사용 가능한 수업권이 없을 때 hold_entitlement()가 던지는 원시 SQL 예외
// 메시지를 그대로 노출하지 않고 이 상수로 매칭해 친화적 메시지로 감싼다.
const RAW_INSUFFICIENT_ENTITLEMENT_MESSAGE = "사용 가능한 수업권이 없습니다.";
const FRIENDLY_INSUFFICIENT_ENTITLEMENT_MESSAGE =
  "사용 가능한 수업권이 부족합니다. 수업권을 추가로 구매하거나 관리자에게 문의해주세요.";

// =========================================================================
// 1. Hold / Consume / Release — R1 함수의 얇은 래퍼
// =========================================================================
// TODO(R6): 이 3개 함수는 최종적으로 학생/보호자가 스스로 트리거하는 예약
// 흐름(부킹 UI)에서 호출된다. 이번 태스크에서는 R6의 실제 인증 경계가 아직
// 설계되지 않았으므로, 다른 관리자 전용 액션과 동일하게 requireAdmin()으로
// 게이트해두고 이 주석으로 명시한다 — R6에서 학생/보호자 본인 세션 기반 인증
// (자기 자녀의 entitlement만 조작 가능한지 확인하는 별도 가드)으로 반드시
// 교체해야 한다. 지금 requireAdmin으로 막아두는 것은 "아무나 호출 가능"보다
// 안전한 임시 상태를 위함이지, R6 최종 형태가 이렇게 유지된다는 뜻이 아니다.

export async function holdEntitlementForReservation(params: {
  childId: string;
  reservationId: string;
  lessonStartAt: string;
  needed?: number;
}): Promise<{ grantId: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hold_entitlement", {
    p_child_id: params.childId,
    p_reservation_id: params.reservationId,
    p_lesson_start_at: params.lessonStartAt,
    p_needed: params.needed ?? 1,
  });
  if (error) {
    if (error.message.includes(RAW_INSUFFICIENT_ENTITLEMENT_MESSAGE)) {
      throw new Error(FRIENDLY_INSUFFICIENT_ENTITLEMENT_MESSAGE);
    }
    throw new Error(error.message);
  }
  return { grantId: data as string };
}

export async function consumeEntitlementForReservation(reservationId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("consume_entitlement", { p_reservation_id: reservationId });
  if (error) {
    if (error.message.includes("해당 예약의 hold를 찾을 수 없습니다")) {
      throw new Error("이 예약에 대한 수업권 hold를 찾을 수 없습니다. 예약 상태를 확인해주세요.");
    }
    if (error.message.includes("이미 consume") || error.message.includes("이미 release")) {
      throw new Error("이미 처리된 예약입니다(중복 소진/해제 시도).");
    }
    throw new Error(error.message);
  }
}

export async function releaseEntitlementForReservation(reservationId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_entitlement", { p_reservation_id: reservationId });
  if (error) {
    if (error.message.includes("해당 예약의 hold를 찾을 수 없습니다")) {
      throw new Error("이 예약에 대한 수업권 hold를 찾을 수 없습니다. 예약 상태를 확인해주세요.");
    }
    if (error.message.includes("이미 release") || error.message.includes("이미 consume")) {
      throw new Error("이미 처리된 예약입니다(중복 해제/소진 시도).");
    }
    throw new Error(error.message);
  }
}

// =========================================================================
// 2. 잔량 확인(구매 유도용)
// =========================================================================

/**
 * entitlement_balances 뷰(R1)를 읽어 특정 자녀가 needed만큼의 잔량을 가지고
 * 있는지 확인한다. R6 부킹 UI와 (다른 태스크의) 구매 유도 UI가 함께 사용할
 * 읽기 전용 체크 — 여기서는 만료되지 않은 grant들의 잔량 합만 본다(hold_entitlement의
 * FEFO 순서까지 재현할 필요는 없다. "충분한가/부족한가"만 판단하면 되므로).
 */
export async function hasSufficientEntitlement(childId: string, needed: number = 1): Promise<boolean> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("entitlement_balances")
    .select("remaining, expires_at")
    .eq("child_id", childId);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const total = (data ?? [])
    .filter((row) => new Date(row.expires_at as string).getTime() > now)
    .reduce((sum, row) => sum + (row.remaining as number), 0);
  return total >= needed;
}

// =========================================================================
// 3. 회사/선생님 귀책 취소 → 만료 임박 grant 연장
// =========================================================================

const EXTENSION_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 취소일(cancellationDate) 기준으로 grant의 현재 만료일이 30일 이내로 남아
 * 있을 때만, 취소일로부터 30일 뒤로 연장한다. 새 만료일은
 * max(기존 만료일, 취소일+30일) — 이미 30일보다 더 먼 만료일을 갖고 있으면
 * 아무 것도 하지 않는다(단축 방지, extend_entitlement 자체도 새 만료일이
 * 기존보다 이후가 아니면 예외를 던지므로 이 사전 조건 검사가 없으면 "연장 불필요"
 * 케이스에서 불필요한 원시 SQL 예외가 노출된다).
 */
export async function extendEntitlementForCompanyOrTeacherCancellation(
  grantId: string,
  cancellationDate: string
): Promise<{ extended: boolean; newExpiresAt?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: grant, error: grantError } = await admin
    .from("entitlement_grants")
    .select("id, expires_at")
    .eq("id", grantId)
    .single();
  if (grantError) throw new Error(grantError.message);
  if (!grant) throw new Error("존재하지 않는 grant입니다.");

  const cancellationMs = new Date(cancellationDate).getTime();
  const currentExpiresMs = new Date(grant.expires_at as string).getTime();
  const withinWindow = currentExpiresMs - cancellationMs <= EXTENSION_WINDOW_DAYS * MS_PER_DAY;
  if (!withinWindow) {
    return { extended: false };
  }

  const candidateExpiresMs = cancellationMs + EXTENSION_WINDOW_DAYS * MS_PER_DAY;
  const newExpiresMs = Math.max(currentExpiresMs, candidateExpiresMs);
  const newExpiresAt = new Date(newExpiresMs).toISOString();

  if (newExpiresMs <= currentExpiresMs) {
    // 이론상 withinWindow 조건과 함께면 여기 도달하지 않지만(취소일+30일이
    // 항상 기존 만료일보다 늦거나 같음), 방어적으로 남겨둔다.
    return { extended: false };
  }

  const businessEventId = `company_teacher_cancel_extend:${grantId}:${cancellationDate}`;
  const { error } = await admin.rpc("extend_entitlement", {
    p_grant_id: grantId,
    p_new_expires_at: newExpiresAt,
    p_business_event_id: businessEventId,
  });
  if (error) throw new Error(error.message);

  return { extended: true, newExpiresAt };
}

// =========================================================================
// 4. 관리자 전용 자녀 간 이전
// =========================================================================

export async function transferEntitlementBetweenChildren(params: {
  sourceGrantId: string;
  destChildId: string;
  amount: number;
  reason: string;
}): Promise<{ newGrantId: string }> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  if (!params.reason) throw new Error("이전 사유(reason)를 입력해주세요.");
  const admin = createAdminClient();

  // transfer_entitlement()는 reason 자체를 저장하지 않고 business_event_id(text)만
  // 받는다. 실제 사유는 이 repo의 기존 관행(DocuSign 웹훅 등)과 동일하게
  // 구조화 console.info 로그로 남긴다 — 이 admin 액션의 감사 흔적은
  // (a) business_event_id에 reason을 함께 인코딩해 entitlement_ledger에서도
  // 역추적 가능하게 하고, (b) console.info 구조화 로그로 actor/reason을
  // 명시적으로 남기는 이중 접근이다.
  const businessEventId = `admin_transfer:${params.sourceGrantId}->${params.destChildId}:${Date.now()}`;

  const { data, error } = await admin.rpc("transfer_entitlement", {
    p_source_grant_id: params.sourceGrantId,
    p_destination_child_id: params.destChildId,
    p_amount: params.amount,
    p_business_event_id: businessEventId,
  });
  if (error) throw new Error(error.message);

  console.info(
    JSON.stringify({
      type: "admin_entitlement_transfer",
      actorUserId,
      sourceGrantId: params.sourceGrantId,
      destChildId: params.destChildId,
      amount: params.amount,
      reason: params.reason,
      newGrantId: data,
      at: new Date().toISOString(),
    })
  );

  return { newGrantId: data as string };
}

// =========================================================================
// 5. 상품/가격 버전
// =========================================================================

export async function createEntitlementProductVersion(params: {
  productId: string;
  priceMinor: number;
  unitPriceMinor: number;
  discountMinor?: number;
  discountPercent?: number;
  validityMonths?: number;
  effectiveFrom: string;
  effectiveUntil?: string;
}): Promise<{ id: string }> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();

  const { data: latest, error: latestError } = await admin
    .from("entitlement_product_versions")
    .select("version_number")
    .eq("entitlement_product_id", params.productId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  const versionNumber = (latest?.version_number ?? 0) + 1;

  const { data, error } = await admin
    .from("entitlement_product_versions")
    .insert({
      entitlement_product_id: params.productId,
      version_number: versionNumber,
      price_minor: params.priceMinor,
      unit_price_minor: params.unitPriceMinor,
      validity_months: params.validityMonths ?? 12,
      discount_minor: params.discountMinor ?? 0,
      discount_percent: params.discountPercent ?? 0,
      effective_from: params.effectiveFrom,
      effective_until: params.effectiveUntil ?? null,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) {
    // entitlement_product_versions_no_overlap exclusion constraint(gist) —
    // 같은 상품에 겹치는 유효 구간의 버전을 만들려 하면 원시 postgres
    // "conflicting key value violates exclusion constraint" 메시지가 나온다.
    // 그대로 노출하지 않고 친화적으로 감싼다.
    if (error.message.includes("entitlement_product_versions_no_overlap")) {
      throw new Error("이 상품의 유효 기간이 기존 가격 버전과 겹칩니다. effectiveFrom/effectiveUntil을 조정해주세요.");
    }
    throw new Error(error.message);
  }

  // 정책: effective_from이 지금으로부터 30일 넘게 남은 새 버전이면 가격 변경
  // 공지 대상으로 등록한다(§5. price_change_notices 참고, notice_required_by
  // = effective_from - 30일). 30일 이내로 임박했거나 이미 지난 effective_from은
  // "사전 공지 창"이 이미 지났으므로 등록하지 않는다(관리자가 별도로 처리).
  const effectiveFromMs = new Date(params.effectiveFrom).getTime();
  const noticeRequiredByMs = effectiveFromMs - EXTENSION_WINDOW_DAYS * MS_PER_DAY;
  if (noticeRequiredByMs > Date.now()) {
    await createPriceChangeNotice(data.id, new Date(noticeRequiredByMs).toISOString());
  }

  return { id: data.id };
}

export async function discontinueEntitlementProductVersion(productVersionId: string): Promise<void> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin
    .from("entitlement_product_versions")
    .update({ discontinued_at: new Date().toISOString() })
    .eq("id", productVersionId);
  if (error) throw new Error(error.message);
}

// =========================================================================
// 6. 환불 워크플로
// =========================================================================

export async function requestRefund(purchaseId: string, reason?: string): Promise<{ id: string }> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();

  const { data: calc, error: calcError } = await admin
    .rpc("calculate_purchase_refund_minor", { p_purchase_id: purchaseId })
    .single();
  if (calcError) throw new Error(calcError.message);
  const calculated = calc as {
    refund_minor: number;
    consumed_count: number;
    within_full_refund_window: boolean;
    blocked_by_active_holds: boolean;
  } | null;
  if (!calculated) throw new Error("존재하지 않는 구매입니다.");
  // M2 — 아직 소진되지 않은 미래 예약이 있으면 요청 접수 단계에서부터 명확히
  // 안내한다(승인 시점에도 refund_entitlement()가 다시 한번 fail-closed로
  // 막는다 — 이중 방어. 여기서 미리 막는 이유는 관리자가 계산도 안 나오는
  // 요청을 만들지 않도록 하기 위함).
  if (calculated.blocked_by_active_holds) {
    throw new Error(
      "아직 소진되지 않은 미래 예약이 있어 환불 요청을 접수할 수 없습니다. 먼저 해당 예약을 취소해 수업권을 해제해주세요."
    );
  }

  const { data, error } = await admin
    .from("refund_requests")
    .insert({
      purchase_id: purchaseId,
      status: "requested",
      calculated_refund_minor: calculated.refund_minor,
      consumed_count_at_calculation: calculated.consumed_count,
      within_full_refund_window: calculated.within_full_refund_window,
      reason: reason ?? null,
      requested_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

/**
 * 관리자 승인. 정책 경계(반드시 지킬 것): 이 함수는 refund_requests의 상태를
 * approved → processing → succeeded로 전이시키고 refund_entitlement()로
 * entitlement 잔량 회수까지 수행한다. 실제 Stripe 환불 API 호출(결제사 쪽
 * 자금 이동)은 여기서 하지 않는다 — 그건 app/api/webhooks/stripe/ 및
 * app/parent/purchase-actions.ts를 다루는 별도 태스크의 영역이다(이 태스크는
 * 해당 파일들을 건드리지 않도록 명시적으로 지시받았다). 그 태스크가
 * refund_requests.status='approved' 이벤트를 보고 실제 Stripe 환불을
 * 트리거하도록 두거나(폴링/트리거는 그 태스크 책임), 이 함수를 이후에 분리해야
 * 한다면 approved에서 멈추도록 나눌 수 있다 — 지금은 "entitlement 쪽 결과는
 * 이 함수가 확정, 결제사 쪽 자금 이동은 별도 관심사"로 명확히 분리해뒀다.
 */
export async function approveRefund(refundRequestId: string): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();

  const { data: refundRequest, error: fetchError } = await admin
    .from("refund_requests")
    .select("id, purchase_id, status")
    .eq("id", refundRequestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!refundRequest) throw new Error("존재하지 않는 환불 요청입니다.");
  if (refundRequest.status !== "requested" && refundRequest.status !== "reviewing") {
    throw new Error(`이미 처리된 환불 요청입니다(현재 상태: ${refundRequest.status}).`);
  }

  const { error: processingError } = await admin
    .from("refund_requests")
    .update({ status: "processing" })
    .eq("id", refundRequestId);
  if (processingError) throw new Error(processingError.message);

  const businessEventId = `refund_request:${refundRequestId}`;
  const { error: refundError } = await admin.rpc("refund_entitlement", {
    p_purchase_id: refundRequest.purchase_id,
    p_business_event_id: businessEventId,
  });
  if (refundError) {
    // entitlement 쪽 처리 실패 시 요청을 processing에 방치하지 않고 requested로
    // 되돌려 관리자가 재시도할 수 있게 한다.
    await admin.from("refund_requests").update({ status: "requested" }).eq("id", refundRequestId);
    throw new Error(refundError.message);
  }

  const { error: succeededError } = await admin
    .from("refund_requests")
    .update({
      status: "succeeded",
      resolved_by: actorUserId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", refundRequestId);
  if (succeededError) throw new Error(succeededError.message);
}

export async function rejectRefund(refundRequestId: string, reason: string): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  if (!reason) throw new Error("반려 사유(reason)를 입력해주세요.");
  const admin = createAdminClient();

  const { data: refundRequest, error: fetchError } = await admin
    .from("refund_requests")
    .select("id, status")
    .eq("id", refundRequestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!refundRequest) throw new Error("존재하지 않는 환불 요청입니다.");
  if (refundRequest.status !== "requested" && refundRequest.status !== "reviewing") {
    throw new Error(`이미 처리된 환불 요청입니다(현재 상태: ${refundRequest.status}).`);
  }

  const { error } = await admin
    .from("refund_requests")
    .update({
      status: "rejected",
      reason,
      resolved_by: actorUserId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", refundRequestId);
  if (error) throw new Error(error.message);
}

// =========================================================================
// 7. 가격 변경 공지 아웃박스
// =========================================================================

export async function createPriceChangeNotice(
  productVersionId: string,
  noticeRequiredBy: string
): Promise<{ id: string }> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("price_change_notices")
    .insert({
      product_version_id: productVersionId,
      notice_required_by: noticeRequiredBy,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function listOpenPriceChangeNotices(): Promise<
  Array<{ id: string; productVersionId: string; noticeRequiredBy: string; status: string }>
> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("price_change_notices")
    .select("id, product_version_id, notice_required_by, status")
    .eq("status", "pending")
    .order("notice_required_by", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    productVersionId: row.product_version_id,
    noticeRequiredBy: row.notice_required_by,
    status: row.status,
  }));
}

// =========================================================================
// 8. 관리자 구매 상세 조회 — entitlement-data.ts의 읽기 전용 로더를
//    admin 클라이언트로 감싼 서버 액션(클라이언트 컴포넌트에서 직접 호출용).
// =========================================================================

export async function adminLookupPurchaseDetail(purchaseId: string): Promise<PurchaseDetailItem | null> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  return loadPurchaseDetail(admin, purchaseId);
}

/** 진행 중이거나 최근 종결된 Stripe 분쟁 목록 — "결제 실패·대사" 화면용. */
export async function listOpenOrRecentPaymentDisputes(): Promise<PaymentDisputeItem[]> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  return loadOpenOrRecentPaymentDisputes(admin);
}

// =========================================================================
// 9. 목록: 대기 중인 환불 요청 / 대사 필요 구매
// =========================================================================

export async function listPendingRefundRequests(): Promise<
  Array<{
    id: string;
    purchaseId: string;
    status: string;
    calculatedRefundMinor: number;
    consumedCountAtCalculation: number;
    /** M2 — 요청 접수 시점에 7일 이내+미사용 전액환불 규칙이 적용됐는지 스냅샷. */
    withinFullRefundWindow: boolean;
    reason: string | null;
    createdAt: string;
  }>
> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("refund_requests")
    .select(
      "id, purchase_id, status, calculated_refund_minor, consumed_count_at_calculation, within_full_refund_window, reason, created_at"
    )
    .in("status", ["requested", "reviewing", "processing"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    purchaseId: row.purchase_id,
    status: row.status,
    calculatedRefundMinor: row.calculated_refund_minor,
    consumedCountAtCalculation: row.consumed_count_at_calculation,
    withinFullRefundWindow: Boolean(row.within_full_refund_window),
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

/**
 * payment_attempts.status='reconciliation_needed'로 남아있는 구매 목록.
 * v3_payment_attempt_status enum이 이 값을 포함한다는 전제(R1/R3에서 정의) —
 * 이 값이 실제로 없다면 이 로더는 빈 배열만 반환한다(스키마를 여기서 새로
 * 만들지 않는다는 제약과 일관).
 */
export async function listPurchasesNeedingReconciliation(): Promise<
  Array<{ purchaseId: string; paymentAttemptId: string; failureReason: string | null; createdAt: string }>
> {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_attempts")
    .select("id, purchase_id, failure_reason, created_at")
    .eq("status", "reconciliation_needed")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    purchaseId: row.purchase_id,
    paymentAttemptId: row.id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  }));
}
