import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

test("관리자가 새 과목을 만들고 회차를 추가할 수 있다", async ({ page }) => {
  const subjectName = `E2E Test Subject ${Date.now()}`;

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=catalog");
  await expect(page.getByRole("heading", { name: "과목 템플릿" })).toBeVisible();

  await page.getByRole("button", { name: "+ 과목 추가" }).click();
  await page.getByPlaceholder("새 과목명").fill(subjectName);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(subjectName)).toBeVisible();

  await page
    .locator(`xpath=//div[contains(., "${subjectName}")][.//button[text()="편집"]]`)
    .last()
    .getByRole("button", { name: "편집" })
    .click();

  await page.getByRole("button", { name: "+ 회차 추가" }).click();
  await expect(page.locator('input[value="새 회차"]')).toBeVisible();
});

test("관리자 대시보드에 상담 요청/승인 대기 위젯이 보인다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await expect(page.getByText(/상담 요청 대기/)).toBeVisible();
  await expect(page.getByText(/학생 매칭 대기/)).toBeVisible();
  await expect(page.getByText(/선생님 승인 대기/)).toBeVisible();
});
