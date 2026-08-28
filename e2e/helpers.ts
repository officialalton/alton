import type { Page } from "@playwright/test";

export const DEV_PASSWORD = "alton-dev-1234";

export const ACCOUNTS = {
  admin: "admin@alton.education",
  teacher: "seoyeon@example.com",
  student: "jihoon@example.com",
  parent: "minji.kim@example.com",
} as const;

export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
