import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEntitlementGrantForPurchase } from "./entitlements";

const grantMaybeSingleMock = vi.fn();
const purchaseSingleMock = vi.fn();
const grantInsertSingleMock = vi.fn();
const ledgerInsertMock = vi.fn();
const raceGrantMaybeSingleMock = vi.fn();

function makeAdmin() {
  let grantSelectCallCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "entitlement_grants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => {
                grantSelectCallCount += 1;
                // 첫 조회는 "이미 있는지" 확인, 두 번째(경쟁 재확인)는 별도 mock 사용.
                return grantSelectCallCount === 1 ? grantMaybeSingleMock() : raceGrantMaybeSingleMock();
              },
            }),
          }),
          insert: () => ({
            select: () => ({ single: grantInsertSingleMock }),
          }),
        };
      }
      if (table === "purchases") {
        return { select: () => ({ eq: () => ({ single: purchaseSingleMock }) }) };
      }
      if (table === "entitlement_ledger") {
        return { insert: ledgerInsertMock };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("createEntitlementGrantForPurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantMaybeSingleMock.mockResolvedValue({ data: null });
    raceGrantMaybeSingleMock.mockResolvedValue({ data: null });
    purchaseSingleMock.mockResolvedValue({
      data: { id: "purchase1", child_id: "child1", entitlement_product_id: "prod1", quantity: 20, validity_months: 12 },
      error: null,
    });
    grantInsertSingleMock.mockResolvedValue({ data: { id: "grant1" }, error: null });
    ledgerInsertMock.mockResolvedValue({ error: null });
  });

  it("purchase로 grant와 grant-type ledger 행을 만든다", async () => {
    const admin = makeAdmin();
    const result = await createEntitlementGrantForPurchase(admin as never, "purchase1");

    expect(result).toEqual({ grantId: "grant1", created: true });
    expect(ledgerInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        grant_id: "grant1",
        event_type: "grant",
        amount: 20,
        business_event_id: "purchase:purchase1",
      })
    );
  });

  it("이미 이 purchase로 만든 grant가 있으면 새로 만들지 않는다(멱등)", async () => {
    grantMaybeSingleMock.mockResolvedValue({ data: { id: "existing-grant" } });
    const admin = makeAdmin();

    const result = await createEntitlementGrantForPurchase(admin as never, "purchase1");

    expect(result).toEqual({ grantId: "existing-grant", created: false });
    expect(grantInsertSingleMock).not.toHaveBeenCalled();
    expect(ledgerInsertMock).not.toHaveBeenCalled();
  });

  it("같은 purchase에 대해 두 번 호출해도 두 번째 호출에서 첫 조회가 기존 grant를 찾으면 중복 생성하지 않는다", async () => {
    const admin = makeAdmin();

    const first = await createEntitlementGrantForPurchase(admin as never, "purchase1");
    expect(first.created).toBe(true);

    // 두 번째 호출: 새 admin 인스턴스(별도 호출 컨텍스트)를 쓰되, "이미 있는지"
    // 조회가 방금 만든 grant를 반환한다고 가정한다.
    grantMaybeSingleMock.mockResolvedValue({ data: { id: "grant1" } });
    const admin2 = makeAdmin();
    const second = await createEntitlementGrantForPurchase(admin2 as never, "purchase1");

    expect(second).toEqual({ grantId: "grant1", created: false });
    expect(grantInsertSingleMock).toHaveBeenCalledTimes(1);
    expect(ledgerInsertMock).toHaveBeenCalledTimes(1);
  });

  it("존재하지 않는 purchase면 에러를 던진다", async () => {
    purchaseSingleMock.mockResolvedValue({ data: null, error: { message: "not found" } });
    const admin = makeAdmin();

    await expect(createEntitlementGrantForPurchase(admin as never, "bad")).rejects.toThrow();
  });
});
