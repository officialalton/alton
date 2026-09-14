import type { SupabaseClient } from "@supabase/supabase-js";

// R4 — 결제 성공 시 entitlement_grants/entitlement_ledger를 만드는 공용 로직.
// Stripe 웹훅(app/api/webhooks/stripe/route.ts)에서 호출한다.
//
// 멱등성이 이 함수의 핵심 계약이다: 같은 purchaseId로 두 번 호출되어도(웹훅
// 재시도, 이벤트 중복 배달이 idempotency 레이어를 어떤 이유로든 통과한 경우
// 등) grant를 두 번 만들지 않는다 — "이미 이 purchase로 만들어진 grant가
// 있는가"를 insert 전에 먼저 확인한다. entitlement_ledger 쪽도 R1의
// business_event_id 기반 unique dedup 인덱스(entitlement_ledger_business_event_dedup)가
// 두 번째 insert를 온전히 막아준다(on conflict do nothing과 동일한 효과를
// DB 제약으로 강제).
export type CreateEntitlementGrantResult = {
  grantId: string;
  created: boolean; // false면 이미 존재하던 grant를 그대로 반환한 것(멱등 skip)
};

export async function createEntitlementGrantForPurchase(
  admin: SupabaseClient,
  purchaseId: string
): Promise<CreateEntitlementGrantResult> {
  // 1) 이미 이 purchase로 만들어진 grant가 있으면 그대로 반환(멱등).
  const { data: existingGrant } = await admin
    .from("entitlement_grants")
    .select("id")
    .eq("purchase_id_ref", purchaseId)
    .maybeSingle();
  if (existingGrant) {
    return { grantId: existingGrant.id as string, created: false };
  }

  const { data: purchase, error: purchaseError } = await admin
    .from("purchases")
    .select("id, child_id, entitlement_product_id, quantity, validity_months")
    .eq("id", purchaseId)
    .single();
  if (purchaseError || !purchase) {
    throw new Error(`구매 내역을 찾을 수 없습니다: ${purchaseId}`);
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + purchase.validity_months);

  const { data: grant, error: grantError } = await admin
    .from("entitlement_grants")
    .insert({
      child_id: purchase.child_id,
      entitlement_product_id: purchase.entitlement_product_id,
      purchase_id_ref: purchase.id,
      original_quantity: purchase.quantity,
      expires_at: expiresAt.toISOString(),
      is_paid: true,
    })
    .select("id")
    .single();
  if (grantError || !grant) {
    // 동시 웹훅 재시도로 두 요청이 동시에 이 지점에 도달했을 가능성 —
    // unique 제약은 없지만(설계상 purchase_id_ref는 unique 인덱스가 아님),
    // 방금 다른 요청이 먼저 만들었는지 다시 확인하고 있으면 그것을 반환한다.
    const { data: raceGrant } = await admin
      .from("entitlement_grants")
      .select("id")
      .eq("purchase_id_ref", purchaseId)
      .maybeSingle();
    if (raceGrant) {
      return { grantId: raceGrant.id as string, created: false };
    }
    throw new Error(grantError?.message ?? "entitlement grant 생성에 실패했습니다.");
  }

  // grant-type ledger row. business_event_id는 purchaseId 기준으로 고정해
  // entitlement_ledger_business_event_dedup(grant_id, event_type, business_event_id)
  // unique 인덱스가 정확히 같은 grant에 대한 중복 grant 이벤트를 막아준다.
  const { error: ledgerError } = await admin.from("entitlement_ledger").insert({
    grant_id: grant.id,
    event_type: "grant",
    amount: purchase.quantity,
    business_event_id: `purchase:${purchaseId}`,
  });
  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  return { grantId: grant.id as string, created: true };
}
