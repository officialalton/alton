import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// R4 — 관리자 "수업권" 원장 탭: 새 가격 버전 생성 UI가 실제로 동작하는지 검증.
//
// entitlement_product_versions에는 상품당 겹치지 않는 유효 구간 exclusion
// constraint(gist)가 있다 — lesson_pack_1의 현재 버전은 effective_until이
// null(무한)이라 "지금" 시점에 새 버전을 만들면 반드시 겹친다. 그래서 격리된
// 방식으로: 기존 버전의 effective_until을 먼 미래(2099-01-01)로 한시적으로
// 좁혀(그래도 "지금"은 계속 그 버전이 유효 — 다른 스펙에 영향 없음) 그 이후
// 구간(2099-06-01~)에 새 버전을 만든다. afterAll에서 정확히 원상복구한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const FAR_FUTURE_BOUNDARY = "2099-01-01T00:00:00Z";
const NEW_VERSION_EFFECTIVE_FROM = "2099-06-01T00:00";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

let productId: string;
let originalVersionId: string;
let createdVersionId: string | null = null;

test.describe("R4 — 관리자 수업권 원장: 상품·가격 버전 생성", () => {
  test.beforeAll(() => {
    productId = psql(`select id from entitlement_products where code = 'lesson_pack_1';`).trim();
    originalVersionId = psql(
      `select id from entitlement_product_versions where entitlement_product_id = '${productId}' and effective_until is null;`
    ).trim();
    expect(originalVersionId).toMatch(/^[0-9a-f-]{36}$/);
    psql(
      `update entitlement_product_versions set effective_until = '${FAR_FUTURE_BOUNDARY}' where id = '${originalVersionId}';`
    );
  });

  test.afterAll(() => {
    if (createdVersionId) {
      // 새 버전 생성 시 30일 고지 아웃박스(price_change_notices)에 관련 행이
      // 자동으로 생겨 FK로 물려있어 먼저 지운다.
      psql(`delete from price_change_notices where product_version_id = '${createdVersionId}';`);
      psql(`delete from entitlement_product_versions where id = '${createdVersionId}';`);
    }
    psql(
      `update entitlement_product_versions set effective_until = null where id = '${originalVersionId}';`
    );
  });

  test("새 가격 버전 생성 폼 제출 → 목록에 새 버전이 나타난다", async ({ page }) => {
    test.setTimeout(60000);

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=entitlements");
    await expect(page.getByRole("heading", { name: "수업권 원장" })).toBeVisible();

    // 기본 서브탭이 "상품·가격 버전"이지만 명시적으로 클릭해 상태를 확실히 한다.
    await page.getByRole("button", { name: "상품·가격 버전" }).click();

    await page.locator("select").selectOption({ label: "lesson_pack_1 (1)" });
    const priceInputs = page.getByPlaceholder(/가격\(minor\)$/);
    await priceInputs.first().fill("30000"); // 총 가격(minor)
    await page.getByPlaceholder("단가(minor)").fill("30000");
    await page.locator('input[type="datetime-local"]').first().fill(NEW_VERSION_EFFECTIVE_FROM);

    await page.getByRole("button", { name: "가격 버전 생성" }).last().click();
    await page.waitForTimeout(2500);

    createdVersionId = psql(
      `select id from entitlement_product_versions where entitlement_product_id = '${productId}' and id != '${originalVersionId}' order by version_number desc limit 1;`
    ).trim();
    expect(createdVersionId, "새 가격 버전이 DB에 생성되지 않았습니다").toMatch(/^[0-9a-f-]{36}$/);
    const versionNumber = psql(
      `select version_number from entitlement_product_versions where id = '${createdVersionId}';`
    ).trim();

    await page.reload();
    await page.getByRole("button", { name: "상품·가격 버전" }).click();
    await expect(page.getByText(`lesson_pack_1 v${versionNumber}`, { exact: false })).toBeVisible();
  });
});
