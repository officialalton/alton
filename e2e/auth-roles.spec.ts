import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

test("관리자 로그인 시 /admin으로 이동하고 대시보드를 본다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: /안녕하세요/ })).toBeVisible();
});

test("선생님 로그인 시 /teacher로 이동한다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.teacher);
  await expect(page).toHaveURL(/\/teacher/);
  await expect(page.getByText("박서연 선생님", { exact: false }).first()).toBeVisible();
});

test("학생 로그인 시 /student로 이동한다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.student);
  await expect(page).toHaveURL(/\/student/);
  await expect(page.getByText("지훈", { exact: false }).first()).toBeVisible();
});

test("학부모 로그인 시 /parent로 이동한다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.parent);
  await expect(page).toHaveURL(/\/parent/);
});

test("다른 역할의 포털 경로에 직접 접근하면 본인 포털로 리다이렉트된다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.student);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/student/);
});

test("로그아웃 후에는 다시 로그인 화면으로 돌아간다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await page.getByRole("button", { name: /관리자/ }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login/);
});
