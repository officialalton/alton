import { test, expect } from "@playwright/test";

test("랜딩페이지가 로드되고 상담 신청 폼을 제출하면 접수 확인 문구가 뜬다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /골든타임을 놓치기 전/ })).toBeVisible();

  await page.locator("#consult").scrollIntoViewIfNeeded();
  await page.getByLabel("학부모 이름").fill("이수진 (E2E)");
  await page.getByRole("textbox", { name: "이메일" }).fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel(/개인정보 수집·이용에 동의합니다/).check();

  await page.getByRole("button", { name: "상담 신청하기" }).click();

  await expect(page.getByText("상담 신청이 접수되었습니다.")).toBeVisible();
});

test("로그인 링크는 /login으로 이동한다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "로그인" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});
