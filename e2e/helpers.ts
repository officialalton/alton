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
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
