import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

test("선생님이 지난 수업 리뷰를 제출하면, 학생 포털에도 그 리뷰가 그대로 보인다", async ({
  page,
  browser,
}) => {
  await loginAs(page, ACCOUNTS.teacher);
  await page.goto("/teacher?tab=schedule");
  await page.getByRole("button", { name: "지난 수업" }).click();

  await page
    .getByRole("button", { name: /리뷰 작성|리뷰 수정/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "수업 리뷰 작성" })).toBeVisible();

  const textareas = page.locator("textarea");
  await textareas.nth(0).fill("E2E: 개념을 정확히 이해하고 있습니다.");
  await textareas.nth(4).fill("E2E: 이번 수업은 전반적으로 좋았습니다.");

  await page.getByRole("button", { name: "리뷰 제출" }).click();
  await expect(page.getByText("✓ 제출되었습니다")).toBeVisible();

  await page.goto("/teacher?tab=schedule");
  await page.getByRole("button", { name: "지난 수업" }).click();
  await expect(page.getByRole("button", { name: "리뷰 수정" }).first()).toBeVisible();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await loginAs(studentPage, ACCOUNTS.student);
  await studentPage.goto("/student?tab=lessons");
  await studentPage.getByRole("button", { name: "지난 수업" }).click();
  await studentPage
    .getByRole("button", { name: /^리뷰 보기$/ })
    .first()
    .click();
  await expect(studentPage.getByText("E2E: 이번 수업은 전반적으로 좋았습니다.")).toBeVisible();
  await expect(studentPage.getByText("E2E: 개념을 정확히 이해하고 있습니다.")).toBeVisible();

  await studentContext.close();
});
