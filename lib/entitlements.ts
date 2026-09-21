import type { SupabaseClient } from "@supabase/supabase-js";

// R4 — 결제 성공 시 entitlement_grants/entitlement_ledger를 만드는 공용 로직.
// Stripe 웹훅(app/api/webhooks/stripe/route.ts)에서 호출한다.
//
// 2026-09-21(기획자 리뷰 P1) — grant INSERT 와 ledger INSERT 가 별도 쿼리라 원자적이지 않았다:
// grant 뒤 ledger 가 실패하면 "결제는 됐는데 잔액 0" 상태가 남고, 재시도는 기존 grant 만 보고 조기
// 종료해 그 상태가 영구화됐다. 이제 DB 함수 create_entitlement_grant_for_purchase() 한 트랜잭션이
// (1) grant 가 없으면 만들고(purchase_id_ref 유니크로 동시 경합도 차단), (2) grant-type ledger 가 없으면
// 채운다 — 같은 purchaseId 로 몇 번 불려도 결과가 같고, 과거에 ledger 만 빠진 grant 도 치유된다.
export type CreateEntitlementGrantResult = {
  grantId: string;
  created: boolean; // false면 이미 존재하던 grant를 그대로 반환한 것(멱등 skip)
};

export async function createEntitlementGrantForPurchase(
  admin: SupabaseClient,
  purchaseId: string
): Promise<CreateEntitlementGrantResult> {
  const { data, error } = await admin.rpc("create_entitlement_grant_for_purchase", { p_purchase_id: purchaseId });
  if (error) throw new Error(error.message);
  const row = data as { grantId?: string; created?: boolean } | null;
  if (!row?.grantId) throw new Error("entitlement grant 생성에 실패했습니다.");
  return { grantId: row.grantId, created: Boolean(row.created) };
}
