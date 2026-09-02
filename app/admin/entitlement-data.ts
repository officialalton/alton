import type { SupabaseClient } from "@supabase/supabase-js";

// R4 관리자 UI용 읽기 전용 데이터 로더(consultation-data.ts와 동일한 관행 —
// 쓰기는 entitlement-actions.ts의 "use server" 액션을 클라이언트 컴포넌트에서
// 직접 호출). purchase_receipts 뷰(20260922000000 §6)와
// entitlement_product_versions를 조합해 관리자 화면이 필요로 할 구매 상세 +
// 상품/가격 버전 목록을 제공한다.

export type PurchaseDetailItem = {
  purchaseId: string;
  householdId: string;
  childId: string;
  contractId: string;
  contractVersionNumber: number | null;
  productCode: string;
  productVersionId: string;
  quantity: number;
  unitPriceMinor: number;
  packagePriceMinor: number;
  discountMinor: number;
  discountPercent: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  validityMonths: number;
  expiresAt: string | null;
  pricePolicyVersion: string | null;
  refundPolicyVersion: string;
  termsVersion: string | null;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export async function loadPurchaseDetail(
  supabase: SupabaseClient,
  purchaseId: string
): Promise<PurchaseDetailItem | null> {
  const { data: row, error } = await supabase
    .from("purchase_receipts")
    .select(
      "purchase_id, household_id, child_id, contract_id, contract_version_number, product_code, product_version_id, quantity, unit_price_minor, package_price_minor, discount_minor, discount_percent, tax_minor, total_minor, currency, validity_months, expires_at, price_policy_version, refund_policy_version, terms_version, status, stripe_checkout_session_id, stripe_payment_intent_id, created_at, confirmed_at"
    )
    .eq("purchase_id", purchaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  return {
    purchaseId: row.purchase_id,
    householdId: row.household_id,
    childId: row.child_id,
    contractId: row.contract_id,
    contractVersionNumber: row.contract_version_number,
    productCode: row.product_code,
    productVersionId: row.product_version_id,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    packagePriceMinor: row.package_price_minor,
    discountMinor: row.discount_minor,
    discountPercent: row.discount_percent,
    taxMinor: row.tax_minor,
    totalMinor: row.total_minor,
    currency: row.currency,
    validityMonths: row.validity_months,
    expiresAt: row.expires_at,
    pricePolicyVersion: row.price_policy_version,
    refundPolicyVersion: row.refund_policy_version,
    termsVersion: row.terms_version,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

export type PaymentDisputeItem = {
  id: string;
  purchaseId: string | null;
  stripeDisputeId: string;
  stripeChargeId: string;
  stripePaymentIntentId: string | null;
  status: string;
  amountMinor: number;
  currency: string;
  reason: string | null;
  stripeCreatedAt: string | null;
  stripeUpdatedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Stripe 분쟁 상태 중 "종결"로 보는 값 — closed_at이 채워지는 시점과 별개로
// 화면에서 "진행 중" 필터링에 쓴다(won/lost/charge_refunded는 Stripe 쪽 최종
// 상태, warning_closed도 워닝 단계 종결).
const CLOSED_DISPUTE_STATUSES = new Set(["won", "lost", "charge_refunded", "warning_closed"]);

/**
 * 열려 있는(진행 중인) 분쟁 + 최근 종결된 분쟁을 함께 반환 — 관리자 대사
 * 화면(EntitlementLedgerTab "결제 실패·대사")에서 "open or recent"를 모두
 * 보여줘야 하므로, closed_at 유무가 아니라 최근성으로 좁힌다(최근 30일 종결
 * 포함, 그 외 open 상태는 기간 제한 없음).
 */
export async function loadOpenOrRecentPaymentDisputes(
  supabase: SupabaseClient
): Promise<PaymentDisputeItem[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("payment_disputes")
    .select(
      "id, purchase_id, stripe_dispute_id, stripe_charge_id, stripe_payment_intent_id, status, amount_minor, currency, reason, stripe_created_at, stripe_updated_at, closed_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => !CLOSED_DISPUTE_STATUSES.has(row.status) || row.updated_at >= thirtyDaysAgo)
    .map((row) => ({
      id: row.id,
      purchaseId: row.purchase_id,
      stripeDisputeId: row.stripe_dispute_id,
      stripeChargeId: row.stripe_charge_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      status: row.status,
      amountMinor: row.amount_minor,
      currency: row.currency,
      reason: row.reason,
      stripeCreatedAt: row.stripe_created_at,
      stripeUpdatedAt: row.stripe_updated_at,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

export type EntitlementProductListItem = {
  id: string;
  code: string;
  quantity: number;
};

/** 상품 마스터(entitlement_products) 목록 — 가격 버전 생성 폼의 상품 선택지용. */
export async function loadEntitlementProducts(
  supabase: SupabaseClient
): Promise<EntitlementProductListItem[]> {
  const { data, error } = await supabase
    .from("entitlement_products")
    .select("id, code, quantity")
    .order("code", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    quantity: row.quantity,
  }));
}

export type ProductVersionListItem = {
  id: string;
  entitlementProductId: string;
  productCode: string;
  versionNumber: number;
  priceMinor: number;
  unitPriceMinor: number;
  currency: string;
  validityMonths: number;
  discountMinor: number;
  discountPercent: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  discontinuedAt: string | null;
};

/** 상품별 가격 버전 목록 — 최신순. productId를 주면 그 상품으로만 좁힌다. */
export async function loadEntitlementProductVersions(
  supabase: SupabaseClient,
  productId?: string
): Promise<ProductVersionListItem[]> {
  let query = supabase
    .from("entitlement_product_versions")
    .select(
      "id, entitlement_product_id, version_number, price_minor, unit_price_minor, currency, validity_months, discount_minor, discount_percent, effective_from, effective_until, discontinued_at, entitlement_products(code)"
    )
    .order("effective_from", { ascending: false });
  if (productId) {
    query = query.eq("entitlement_product_id", productId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    entitlementProductId: row.entitlement_product_id,
    productCode: (row as { entitlement_products?: { code?: string } }).entitlement_products?.code ?? "",
    versionNumber: row.version_number,
    priceMinor: row.price_minor,
    unitPriceMinor: row.unit_price_minor,
    currency: row.currency,
    validityMonths: row.validity_months,
    discountMinor: row.discount_minor,
    discountPercent: row.discount_percent,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    discontinuedAt: row.discontinued_at,
  }));
}
