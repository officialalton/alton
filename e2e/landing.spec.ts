import { test, expect } from "@playwright/test";

test("랜딩페이지가 로드되고 상담 예약 섹션에 상담 신청 폼이 뜬다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /골든타임을 놓치기 전/ })).toBeVisible();

  await page.locator("#consult").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "1:1 수업 상담 신청" })).toBeVisible();
});

test("로그인 링크는 /login으로 이동한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "로그인" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});
