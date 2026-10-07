import { test, expect } from "@playwright/test";

test("랜딩페이지가 로드되고 상담 예약 섹션에 상담 신청 폼이 뜬다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.locator("#consult").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: /tutoring consultation/i })).toBeVisible();
});

test("로그인 링크는 /login으로 이동한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /^Log in$/i }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
