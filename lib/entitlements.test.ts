import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEntitlementGrantForPurchase } from "./entitlements";

// 2026-09-21 — grant+ledger 생성은 DB 함수 create_entitlement_grant_for_purchase() 한 트랜잭션으로 옮겼다.
// 여기서는 RPC 호출 계약(인자·결과 매핑·오류 전파)만 검증한다. 원자성·멱등성·치유 동작은
// lib/entitlements.integration.test.ts 가 실제 로컬 DB 로 검증한다.
const rpcMock = vi.fn();
const admin = { rpc: rpcMock } as unknown as Parameters<typeof createEntitlementGrantForPurchase>[0];

describe("createEntitlementGrantForPurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purchaseId 로 RPC 를 호출하고 grantId/created 를 그대로 돌려준다", async () => {
    rpcMock.mockResolvedValue({ data: { grantId: "grant1", created: true }, error: null });
    const result = await createEntitlementGrantForPurchase(admin, "purchase1");
    expect(rpcMock).toHaveBeenCalledWith("create_entitlement_grant_for_purchase", { p_purchase_id: "purchase1" });
    expect(result).toEqual({ grantId: "grant1", created: true });
  });

  it("이미 있던 grant 면 created=false 로 돌려준다(멱등)", async () => {
    rpcMock.mockResolvedValue({ data: { grantId: "grant1", created: false }, error: null });
    expect(await createEntitlementGrantForPurchase(admin, "purchase1")).toEqual({ grantId: "grant1", created: false });
  });

  it("RPC 오류는 그대로 던진다(웹훅이 500 으로 되돌려 재시도되게)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "구매 내역을 찾을 수 없습니다: purchase1" } });
    await expect(createEntitlementGrantForPurchase(admin, "purchase1")).rejects.toThrow("구매 내역을 찾을 수 없습니다");
  });
});
