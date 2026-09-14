import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// R4 — 보호자 "수업권 구매" 플로우. 실제 Stripe 결제 완료(성공 리다이렉트)까지는
// 검증하지 않는다(실제 Stripe API 호출 여부는 STRIPE_SECRET_KEY에 달려 있고, 이
// 작업은 로컬 스택 전용이라 실제 외부 호출 성공을 강제하지 않는다) — 대신
// createEntitlementCheckoutSession 서버 액션이 Stripe 호출 "이전"에 실제로
// 만드는 것(purchases 행 + 가격/정책 스냅샷)이 정확한지를 psql로 검증한다.
//
// 격리된 고정 fixture만 쓴다(account-lifecycle/account-merge.spec.ts가 쓰는
// 공유 전역 seed 패턴은 문서화된 flaky 이슈가 있어 여기서는 쓰지 않는다) —
// 이 파일은 기존 household(aabbccdd-...0001, 보호자 김민지)의 두 자녀
// (지훈/이서아)에 대해 매 테스트 시작 시 자기 자신의 contracts 행만 직접
// 세팅/정리한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const ELIGIBLE_CHILD_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈
const INELIGIBLE_CHILD_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아 — active 계약 없음

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function cleanup() {
  // purchases/payment_attempts는 여기서 절대 지우지 않는다 — 이 구매 액션이 실제
  // Stripe 테스트 키로 Checkout Session을 만드는 데 성공하면(로컬 STRIPE_SECRET_KEY가
  // sk_test_...로 유효), 이후(다른 스펙/수동 실행 등) 그 purchase에 entitlement_grants가
  // 걸릴 수 있고, entitlement_grants → purchases FK는 RESTRICT라 delete가 실패한다
  // (entitlement_ledger/entitlement_grants는 재무 감사 이력이라 설계상 불변). 대신
  // contracts만 active가 아니게 되돌린다(status를 바꾸는 UPDATE라 purchases.contract_id
  // FK를 건드리지 않음) — "active 계약이 정확히 1개"라는 unique 제약을 다음 beforeAll이
  // 다시 만족시킬 수 있게 하는 것만이 목적.
  psql(`
    update contracts set status = 'void', voided_at = now(), void_reason = 'e2e cleanup'
    where child_id in ('${ELIGIBLE_CHILD_ID}', '${INELIGIBLE_CHILD_ID}') and status = 'active';
  `);
}

test.describe("R4 — 보호자 수업권 구매 플로우", () => {
  test.beforeAll(() => {
    cleanup();
    // ELIGIBLE_CHILD_ID(지훈)에게만 active 계약을 만든다 — INELIGIBLE_CHILD_ID(이서아)는
    // 의도적으로 계약 없이 남겨 "구매 불가" 자격 검사를 검증한다.
    psql(
      `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${ELIGIBLE_CHILD_ID}', 'active');`
    );
  });
  test.afterAll(() => cleanup());

  test("자격 있는 자녀는 구매 가능, 자격 없는 자녀는 사유와 함께 차단된다 + 구매 시 가격 스냅샷이 기록된다", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // 0. DB에서 현재 유효 가격(단건 lesson_pack_1)을 직접 조회 — UI가 이 값을
    // 하드코딩이 아니라 실제로 DB에서 읽어와 렌더링하는지 비교하기 위함.
    const [priceMinorStr, unitPriceMinorStr, quantityStr] = psql(`
      select v.price_minor, v.unit_price_minor, p.quantity
      from entitlement_product_versions v
      join entitlement_products p on p.id = v.entitlement_product_id
      where p.code = 'lesson_pack_1'
        and v.effective_from <= now() and (v.effective_until is null or v.effective_until > now())
        and v.discontinued_at is null
      order by v.effective_from desc limit 1;
    `)
      .trim()
      .split("|");
    const priceMinor = Number(priceMinorStr);
    expect(quantityStr).toBe("1");
    const expectedPriceText = (priceMinor / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // 1. 보호자 로그인 → 수업권 구매 탭.
    await loginAs(page, ACCOUNTS.parent);
    await page.goto("/parent?tab=entitlements");

    // 2. 라이브 가격이 DB 값과 일치하는지 확인(하드코딩이 아니라 entitlement_product_versions 조회).
    await expect(page.getByText(expectedPriceText, { exact: false }).first()).toBeVisible();

    // 3. 자격 있는 자녀(지훈)는 선택 가능, 자격 없는 자녀(이서아)는 비활성 + 사유 노출.
    // ParentShell 상단에도 자녀 전환 버튼이 별도로 있어(같은 이름) "자녀 선택"
    // 섹션 안으로 범위를 좁힌다.
    const childPickerSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "자녀 선택" }) });
    const eligibleBtn = childPickerSection.getByRole("button", { name: "지훈", exact: true });
    const ineligibleBtn = childPickerSection.getByRole("button", { name: /이서아/ });
    await expect(eligibleBtn).toBeEnabled();
    await expect(ineligibleBtn).toBeDisabled();
    await expect(ineligibleBtn).toHaveText(/구매 불가/);

    // 4. 자격 있는 자녀 선택 → 단건 상품 선택 → 구매하기.
    await eligibleBtn.click();
    await childPickerSection.getByRole("button", { name: /단건 수업권/ }).click();
    const purchaseBtn = page.getByRole("button", { name: /구매하기|이동 중/ });
    await expect(purchaseBtn).toBeEnabled();
    await purchaseBtn.click();

    // 5. Stripe 리다이렉트(외부 호출) 성공 여부와 무관하게, 서버 액션이 Stripe 호출
    // "이전"에 만든 purchases 행 + 가격 스냅샷을 psql로 검증한다. 서버 액션 처리
    // 시간을 잠깐 기다린다(page.waitForTimeout — r3 스펙과 동일한 관례).
    await page.waitForTimeout(4000);

    const purchaseRow = psql(`
      select status, unit_price_minor, package_price_minor, quantity, currency
      from purchases where child_id = '${ELIGIBLE_CHILD_ID}' order by created_at desc limit 1;
    `).trim();
    expect(purchaseRow, "purchases 행이 생성되지 않았습니다 — 구매 버튼 클릭이 서버 액션까지 도달하지 못했을 수 있습니다").not.toBe("");
    const [status, unitPriceMinor, packagePriceMinor] = purchaseRow.split("|");
    expect(["created", "pending", "processing", "succeeded", "failed"]).toContain(status);
    expect(Number(unitPriceMinor)).toBe(Number(unitPriceMinorStr));
    expect(Number(packagePriceMinor)).toBe(priceMinor);
  });
});
