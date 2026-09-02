import { describe, expect, it, vi } from "vitest";
import { loadParentEntitlementsData } from "./entitlements-data";

// 체이닝 가능한 mock 쿼리 빌더 — select/eq/in/lte/is/order 등 어떤 순서로
// 호출돼도 자기 자신을 반환하고, await되면 지정된 결과로 resolve된다.
function makeQuery(result: { data: unknown }) {
  const query: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "in", "lte", "is", "order"];
  for (const m of chainMethods) {
    query[m] = vi.fn(() => query);
  }
  query.then = (resolve: (v: { data: unknown }) => void) => resolve(result);
  return query;
}

function makeTableClient(resultsByTable: Record<string, { data: unknown }>) {
  return {
    from: vi.fn((table: string) => {
      if (!(table in resultsByTable)) {
        throw new Error(`unexpected table ${table}`);
      }
      return makeQuery(resultsByTable[table]);
    }),
  };
}

const NOW_PRODUCT_ID_1 = "prod-1";
const NOW_PRODUCT_ID_20 = "prod-20";

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => adminClientHolder.client,
}));

const adminClientHolder: { client: ReturnType<typeof makeTableClient> | null } = { client: null };

describe("loadParentEntitlementsData", () => {
  const children = [
    { studentId: "s1", name: "지훈" },
    { studentId: "s2", name: "이서아" },
  ];

  function buildUserSupabase(guardianHouseholds: string[], childProfileIds: string[]) {
    let call = 0;
    return {
      from: vi.fn((table: string) => {
        if (table !== "household_members") throw new Error(`unexpected ${table}`);
        call += 1;
        if (call === 1) {
          // guardian household lookup
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: guardianHouseholds.map((h) => ({ household_id: h })) }),
              }),
            }),
          };
        }
        // child links lookup
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({ data: childProfileIds.map((id) => ({ profile_id: id })) }),
            }),
          }),
        };
      }),
    };
  }

  it("guardian household가 없으면 빈 결과를 반환한다", async () => {
    const userSupabase = buildUserSupabase([], []);
    const result = await loadParentEntitlementsData(
      userSupabase as never,
      "guardian1",
      children
    );
    expect(result).toEqual({ prices: [], children: [] });
  });

  it("가격/잔액/구매내역을 조합해 반환한다", async () => {
    const userSupabase = buildUserSupabase(["h1"], ["s1", "s2"]);

    const versionsByProduct: Record<string, unknown[]> = {
      [NOW_PRODUCT_ID_1]: [
        {
          version_number: 1,
          price_minor: 21875,
          unit_price_minor: 21875,
          currency: "USD",
          validity_months: 12,
          discount_minor: 0,
          discount_percent: 0,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_until: null,
          discontinued_at: null,
        },
      ],
      [NOW_PRODUCT_ID_20]: [
        {
          version_number: 1,
          price_minor: 350000,
          unit_price_minor: 21875,
          currency: "USD",
          validity_months: 12,
          discount_minor: 87500,
          discount_percent: 20,
          effective_from: "2026-01-01T00:00:00.000Z",
          effective_until: null,
          discontinued_at: null,
        },
      ],
    };

    function makeVersionsQuery() {
      const query: Record<string, unknown> = {};
      let productId = "";
      query.select = () => query;
      query.eq = (_col: string, val: string) => {
        productId = val;
        return query;
      };
      query.lte = () => query;
      query.is = () => query;
      query.order = () => query;
      query.then = (resolve: (v: { data: unknown }) => void) =>
        resolve({ data: versionsByProduct[productId] ?? [] });
      return query;
    }

    adminClientHolder.client = {
      from: vi.fn((table: string) => {
        if (table === "entitlement_products") {
          return makeQuery({
            data: [
              { id: NOW_PRODUCT_ID_1, code: "lesson_pack_1", quantity: 1 },
              { id: NOW_PRODUCT_ID_20, code: "lesson_pack_20", quantity: 20 },
            ],
          });
        }
        if (table === "entitlement_product_versions") {
          return makeVersionsQuery();
        }
        if (table === "contracts") {
          return makeQuery({ data: [{ child_id: "s1", status: "active" }] });
        }
        if (table === "entitlement_grants") {
          return makeQuery({
            data: [{ id: "g1", child_id: "s1", expires_at: "2027-01-01T00:00:00.000Z" }],
          });
        }
        if (table === "entitlement_ledger") {
          return makeQuery({ data: [{ grant_id: "g1", amount: 5 }] });
        }
        if (table === "purchase_receipts") {
          return makeQuery({
            data: [
              {
                purchase_id: "pu1",
                child_id: "s1",
                contract_id: "c1",
                contract_version_number: 2,
                product_code: "lesson_pack_20",
                quantity: 20,
                unit_price_minor: 21875,
                package_price_minor: 350000,
                discount_minor: 87500,
                discount_percent: 20,
                tax_minor: 0,
                total_minor: 350000,
                currency: "USD",
                validity_months: 12,
                expires_at: "2027-01-01T00:00:00.000Z",
                price_policy_version: "1",
                refund_policy_version: "r4-2026-09-01",
                terms_version: "r4-2026-09-01",
                status: "confirmed",
                stripe_checkout_session_id: "cs_1",
                stripe_payment_intent_id: "pi_1",
                created_at: "2026-09-01T00:00:00.000Z",
                confirmed_at: "2026-09-01T00:05:00.000Z",
              },
            ],
          });
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as unknown as ReturnType<typeof makeTableClient>;

    const result = await loadParentEntitlementsData(userSupabase as never, "guardian1", children);

    expect(result.prices).toHaveLength(2);
    expect(result.prices.find((p) => p.productCode === "lesson_pack_20")?.discountPercent).toBe(20);

    const s1 = result.children.find((c) => c.childId === "s1")!;
    expect(s1.eligibleForPurchase).toBe(true);
    expect(s1.totalRemaining).toBe(5);
    expect(s1.nearestExpiry).toBe("2027-01-01T00:00:00.000Z");
    expect(s1.purchases).toHaveLength(1);
    expect(s1.purchases[0].purchaseId).toBe("pu1");

    const s2 = result.children.find((c) => c.childId === "s2")!;
    expect(s2.eligibleForPurchase).toBe(false);
    expect(s2.ineligibleReason).toMatch(/active/);
    expect(s2.totalRemaining).toBe(0);
  });
});
