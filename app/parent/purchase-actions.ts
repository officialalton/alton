"use server";

import { requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";

// R4 — 수업권 구매(단건/20회 패키지) Checkout 세션 생성.
//
// 정책(2026-09-22 R4 지시):
// - 결제 가능 자격은 계약 status='active'(R3 결제 가능 경계, DocuSign
//   completed 웹훅이 설정하는 것과 같은 상태)뿐이다.
// - 추가 20회권 구매는 기존 계약에 대한 "새 구매"일 뿐 갱신이 아니다 —
//   이전 구매와 연결 짓지 않는다.
// - 가격/할인/유효기간/정책 버전은 반드시 entitlement_product_versions의
//   "현재 유효한" 행에서 스냅샷으로 고정한다. 그런 행이 없으면(가격 미설정)
//   fail closed — 구매를 절대 진행시키지 않는다.
// - 세금은 지금 항상 0(실제 launch 전 blocker: 세금 서비스 미연동, 별도 정책).
// - 자동 결제/구독 없음 — 매 구매는 항상 새 1회성 Stripe Checkout Session.
// - Stripe test/live 모드는 STRIPE_SECRET_KEY로 결정된다(URL 패턴 검사 아님,
//   DocuSign의 assertDocusignSandboxBaseUri와 다른 방식). 이 저장소가 나중에
//   "정말 test 모드로 도는지" 명시적으로 강제하고 싶다면, 그 가드는 여기
//   getStripe() 호출 직전에 STRIPE_SECRET_KEY.startsWith("sk_test_")류 검사로
//   추가하면 된다 — 지금은 추가하지 않는다(범위 밖).
//
// TODO(terms 버전 시스템): 이용약관은 아직 전용 버전 테이블/소스가 없다
// (repo 전체에 terms_version을 채워주는 다른 코드가 없음 — grep 확인).
// CURRENT_TERMS_VERSION은 "현재 유효한 약관 식별자"에 대한 확정 정책이
// 나올 때까지 쓰는 placeholder이며, refund_policy_version과 같은 텍스트
// 식별자 포맷을 따른다. 진짜 버전 관리 테이블이 생기면 이 상수 대신 거기서
// 조회하도록 교체해야 한다.
const CURRENT_TERMS_VERSION = "r4-2026-09-01";

export type CreateEntitlementCheckoutSessionParams = {
  childId: string;
  entitlementProductCode: string;
};

export async function createEntitlementCheckoutSession(
  params: CreateEntitlementCheckoutSessionParams
): Promise<string> {
  const { childId, entitlementProductCode } = params;
  const { user, supabase } = await requireUser();

  // 1) 호출자가 이 자녀의 household guardian인지 확인.
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id as string);
  if (householdIds.length === 0) {
    throw new Error("보호자 권한이 없습니다.");
  }

  const { data: childLink } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", childId)
    .eq("role", "child")
    .in("household_id", householdIds)
    .maybeSingle();
  if (!childLink) {
    throw new Error("본인 가족 구성원이 아닌 자녀에 대해서는 구매할 수 없습니다.");
  }
  const householdId = childLink.household_id as string;

  // 2) 계약이 결제 가능 상태(active)인지 확인 — fail closed.
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("child_id", childId)
    .eq("status", "active")
    .maybeSingle();
  if (!contract) {
    throw new Error("결제 가능한(active) 계약이 없어 구매할 수 없습니다.");
  }

  // 관리자 클라이언트: entitlement_product_versions/purchases는 일반 RLS로
  // 보호자에게 열려있지 않을 수 있어(가격 정책은 관리자 소유 데이터) service_role로
  // 조회·insert한다. 구매자 신원(guardian/child/contract 검증)은 위에서 이미
  // 사용자 세션 클라이언트로 확인을 마쳤다.
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("entitlement_products")
    .select("id, code, quantity")
    .eq("code", entitlementProductCode)
    .maybeSingle();
  if (!product) {
    throw new Error("존재하지 않는 상품 코드입니다.");
  }

  // 3) 현재 유효한 가격 버전 조회(effective_from <= now < effective_until, 미할인 아님).
  const nowIso = new Date().toISOString();
  const { data: versions } = await admin
    .from("entitlement_product_versions")
    .select(
      "id, version_number, price_minor, unit_price_minor, currency, validity_months, discount_minor, discount_percent, effective_from, effective_until, discontinued_at"
    )
    .eq("entitlement_product_id", product.id)
    .lte("effective_from", nowIso)
    .is("discontinued_at", null)
    .order("effective_from", { ascending: false });

  const productVersion = (versions ?? []).find(
    (v) => v.effective_until === null || v.effective_until === undefined || v.effective_until > nowIso
  );
  if (!productVersion) {
    // fail closed — 정책: 가격 정보 없이 구매를 진행시키지 않는다.
    throw new Error("가격 정보 없음");
  }

  const taxMinor = 0; // TODO(launch blocker): 세금 서비스 미연동, 지금은 항상 0.
  const packagePriceMinor = productVersion.price_minor as number;
  const totalMinor = packagePriceMinor + taxMinor;

  // 4) purchases 행 insert — 가격/정책 전부 스냅샷으로 고정.
  const { data: purchase, error: purchaseError } = await admin
    .from("purchases")
    .insert({
      household_id: householdId,
      child_id: childId,
      contract_id: contract.id,
      entitlement_product_id: product.id,
      product_version_id: productVersion.id,
      quantity: product.quantity,
      unit_price_minor: productVersion.unit_price_minor,
      package_price_minor: packagePriceMinor,
      discount_minor: productVersion.discount_minor,
      discount_percent: productVersion.discount_percent,
      tax_minor: taxMinor,
      total_minor: totalMinor,
      currency: productVersion.currency,
      validity_months: productVersion.validity_months,
      status: "created",
      price_policy_version: String(productVersion.version_number),
      terms_version: CURRENT_TERMS_VERSION,
    })
    .select("id")
    .single();
  if (purchaseError || !purchase) {
    throw new Error(purchaseError?.message ?? "구매 내역 생성에 실패했습니다.");
  }

  // 5) Stripe Checkout Session 생성(1회성 payment 모드, 구독 아님).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: (productVersion.currency as string).toLowerCase(),
            product_data: { name: `${product.code} (${product.quantity}회)` },
            unit_amount: totalMinor,
          },
          quantity: 1,
        },
      ],
      metadata: {
        purchase_id: purchase.id,
        child_id: childId,
        household_id: householdId,
      },
      payment_intent_data: {
        metadata: { purchase_id: purchase.id },
      },
      success_url: `${siteUrl}/parent?tab=entitlements&purchase=success`,
      cancel_url: `${siteUrl}/parent?tab=entitlements&purchase=cancelled`,
    },
    { idempotencyKey: `purchase-checkout:${purchase.id}` }
  );
  if (!session.url) {
    throw new Error("결제 세션 생성에 실패했습니다.");
  }

  // 6) stripe_checkout_session_id를 purchases에 반영.
  const { error: updateError } = await admin
    .from("purchases")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", purchase.id);
  if (updateError) {
    throw new Error(updateError.message);
  }

  return session.url;
}
