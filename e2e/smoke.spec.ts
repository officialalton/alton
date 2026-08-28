import { test, expect } from "@playwright/test";

test("홈페이지가 뜬다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
});
