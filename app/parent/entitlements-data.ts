import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

// R4 — 보호자 "수업권 구매/현황" 화면 데이터 로더(읽기 전용).
//
// purchase-actions.ts의 정책을 그대로 따른다:
// - 가격/구매/수업권 잔액 데이터는 entitlement_product_versions/purchases/
//   entitlement_grants 등 관리자 소유 성격의 테이블이라 service_role(admin
//   client)로 조회한다. 호출자가 실제로 이 자녀들의 household guardian인지는
//   여기서 세션 클라이언트로 먼저 검증한다(household_members).
// - 구매 가능 자격(계약 status='active')은 purchase-actions.ts의
//   createEntitlementCheckoutSession과 동일 조건을 그대로 재사용한다.

export type EntitlementProductPrice = {
  productCode: string;
  productName: string;
  quantity: number;
  unitPriceMinor: number;
  packagePriceMinor: number;
  discountMinor: number;
  discountPercent: number;
  currency: string;
  validityMonths: number;
  versionNumber: number;
};

export type ChildEntitlementBalance = {
  grantId: string;
  remaining: number;
  expiresAt: string | null;
};

export type PurchaseReceipt = {
  purchaseId: string;
  childId: string;
  contractId: string;
  contractVersionNumber: number | null;
  productCode: string;
  productName: string;
  lessonTypeLabel: string | null;
  lessonDurationMinutes: number | null;
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
  refundPolicyVersion: string | null;
  termsVersion: string | null;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  disputeStatus: string | null;
};

/** M2 — 60분 전용 체험수업권(구매·환불·양도 불가, 자녀당 최대 1개). 정규
 * 수업권(totalRemaining/balances)과 절대 합산하지 않는다 — 수업 시간이
 * 다르기 때문에 "정규 수업권이 1개 남았다"는 오해를 주면 안 된다. */
export type ChildEntitlementSummary = {
  childId: string;
  childName: string;
  eligibleForPurchase: boolean;
  ineligibleReason: string | null;
  totalRemaining: number;
  nearestExpiry: string | null;
  balances: ChildEntitlementBalance[];
  trialEntitlement: { grantId: string; remaining: number; expiresAt: string | null } | null;
  purchases: PurchaseReceipt[];
};

export type ParentEntitlementsData = {
  prices: EntitlementProductPrice[];
  children: ChildEntitlementSummary[];
};

const PRODUCT_NAMES: Record<string, string> = {
  lesson_pack_1: "단건 수업권",
  lesson_pack_20: "20회 패키지 수업권",
};

function productDisplayName(code: string): string {
  return PRODUCT_NAMES[code] ?? code;
}

export async function loadParentEntitlementsData(
  supabase: SupabaseClient,
  guardianId: string,
  children: { studentId: string; name: string }[]
): Promise<ParentEntitlementsData> {
  if (children.length === 0) {
    return { prices: [], children: [] };
  }

  // 1) 호출자가 실제 이 자녀들의 household guardian인지 세션 클라이언트로 확인.
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", guardianId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id as string);
  if (householdIds.length === 0) {
    return { prices: [], children: [] };
  }

  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id")
    .in("household_id", householdIds)
    .eq("role", "child");
  const verifiedChildIds = new Set((childLinks ?? []).map((c) => c.profile_id as string));
  const scopedChildren = children.filter((c) => verifiedChildIds.has(c.studentId));
  if (scopedChildren.length === 0) {
    return { prices: [], children: [] };
  }
  const childIds = scopedChildren.map((c) => c.studentId);

  const admin = createAdminClient();

  // 2) 현재 유효한 가격(단건/20회 패키지).
  const nowIso = new Date().toISOString();
  const { data: products } = await admin
    .from("entitlement_products")
    .select("id, code, quantity")
    .in("code", ["lesson_pack_1", "lesson_pack_20"]);

  const prices: EntitlementProductPrice[] = [];
  for (const product of products ?? []) {
    const { data: versions } = await admin
      .from("entitlement_product_versions")
      .select(
        "version_number, price_minor, unit_price_minor, currency, validity_months, discount_minor, discount_percent, effective_from, effective_until, discontinued_at"
      )
      .eq("entitlement_product_id", product.id)
      .lte("effective_from", nowIso)
      .is("discontinued_at", null)
      .order("effective_from", { ascending: false });

    const current = (versions ?? []).find(
      (v) => v.effective_until === null || v.effective_until === undefined || v.effective_until > nowIso
    );
    if (!current) continue;

    prices.push({
      productCode: product.code,
      productName: productDisplayName(product.code),
      quantity: product.quantity,
      unitPriceMinor: current.unit_price_minor,
      packagePriceMinor: current.price_minor,
      discountMinor: current.discount_minor,
      discountPercent: Number(current.discount_percent),
      currency: current.currency,
      validityMonths: current.validity_months,
      versionNumber: current.version_number,
    });
  }

  // 3) 계약 결제 가능 자격(active) — purchase-actions.ts와 동일 조건.
  const { data: contracts } = await admin
    .from("contracts")
    .select("child_id, status")
    .in("child_id", childIds)
    .eq("status", "active");
  const activeChildIds = new Set((contracts ?? []).map((c) => c.child_id as string));

  // 4) 자녀별 수업권 잔액. M2부터 정규(120분)/체험(60분) grant가 공존할 수 있어
  // entitlement_grant_details 뷰(grant + 상품 + 수업유형 + 잔액 합산, 20261012000000
  // §2)로 lesson_type_code별로 갈라 조회한다 — 예전처럼 entitlement_grants를 통째로
  // 합산하면 체험 1회가 "정규 수업권 잔여"에 섞여 보이는 실제 버그가 생긴다.
  const { data: grantDetails } = await admin
    .from("entitlement_grant_details")
    .select("grant_id, child_id, expires_at, remaining, lesson_type_code, source_consultation_id")
    .in("child_id", childIds);
  const regularGrants = (grantDetails ?? []).filter((g) => g.lesson_type_code === "regular");
  const trialGrants = (grantDetails ?? []).filter((g) => g.lesson_type_code === "trial");

  // 5) 자녀별 구매 내역(purchase_receipts).
  const { data: receipts } = await admin
    .from("purchase_receipts")
    .select(
      "purchase_id, child_id, contract_id, contract_version_number, product_code, lesson_type_label, lesson_duration_minutes, quantity, unit_price_minor, package_price_minor, discount_minor, discount_percent, tax_minor, total_minor, currency, validity_months, expires_at, price_policy_version, refund_policy_version, terms_version, status, stripe_checkout_session_id, stripe_payment_intent_id, created_at, confirmed_at, dispute_status"
    )
    .in("child_id", childIds)
    .order("created_at", { ascending: false });

  const summaries: ChildEntitlementSummary[] = scopedChildren.map((child) => {
    const childRegularGrants = regularGrants.filter((g) => g.child_id === child.studentId);
    const balances: ChildEntitlementBalance[] = childRegularGrants
      .map((g) => ({
        grantId: g.grant_id as string,
        remaining: (g.remaining as number) ?? 0,
        expiresAt: (g.expires_at as string) ?? null,
      }))
      .filter((b) => b.remaining > 0);

    const totalRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);
    const nearestExpiry = balances
      .map((b) => b.expiresAt)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null;

    // M2 — 체험수업권(60분, 정규와 절대 합산하지 않음)은 자녀당 최대 1개다
    // (grant_trial_entitlement_for_consultation의 상담당 unique index). 잔량이
    // 남아있는(아직 소진하지 않은) 것만 "사용 가능"으로 노출한다.
    const childTrialGrant = trialGrants.find((g) => g.child_id === child.studentId && (g.remaining as number) > 0);
    const trialEntitlement: ChildEntitlementSummary["trialEntitlement"] = childTrialGrant
      ? {
          grantId: childTrialGrant.grant_id as string,
          remaining: childTrialGrant.remaining as number,
          expiresAt: (childTrialGrant.expires_at as string) ?? null,
        }
      : null;

    const childReceipts: PurchaseReceipt[] = (receipts ?? [])
      .filter((r) => r.child_id === child.studentId)
      .map((r) => ({
        purchaseId: r.purchase_id,
        childId: r.child_id,
        contractId: r.contract_id,
        contractVersionNumber: r.contract_version_number,
        productCode: r.product_code,
        productName: productDisplayName(r.product_code),
        lessonTypeLabel: r.lesson_type_label ?? null,
        lessonDurationMinutes: r.lesson_duration_minutes ?? null,
        quantity: r.quantity,
        unitPriceMinor: r.unit_price_minor,
        packagePriceMinor: r.package_price_minor,
        discountMinor: r.discount_minor,
        discountPercent: Number(r.discount_percent),
        taxMinor: r.tax_minor,
        totalMinor: r.total_minor,
        currency: r.currency,
        validityMonths: r.validity_months,
        expiresAt: r.expires_at,
        pricePolicyVersion: r.price_policy_version,
        refundPolicyVersion: r.refund_policy_version,
        termsVersion: r.terms_version,
        status: r.status,
        stripeCheckoutSessionId: r.stripe_checkout_session_id,
        stripePaymentIntentId: r.stripe_payment_intent_id,
        createdAt: r.created_at,
        confirmedAt: r.confirmed_at,
        disputeStatus: (r as { dispute_status?: string | null }).dispute_status ?? null,
      }));

    const eligible = activeChildIds.has(child.studentId);

    return {
      childId: child.studentId,
      childName: child.name,
      eligibleForPurchase: eligible,
      ineligibleReason: eligible ? null : "결제 가능한(active) 계약이 없습니다.",
      totalRemaining,
      nearestExpiry,
      balances,
      trialEntitlement,
      purchases: childReceipts,
    };
  });

  return { prices, children: summaries };
}
