import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, loginAs } from "./helpers";
import { extractInviteAcceptUrl, findLatestEmailTo } from "./mailbox";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function revokeInviteByEmail(email: string) {
  const sql = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select revoke_account_invite(id) from account_invites
      where email_normalized = lower('${email}') and status = 'pending';
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

// R2 Task 4 — 관리자→보호자 초대 전체 흐름을 실제 브라우저 + 실제 로컬
// 메일함(Mailpit)으로 끝까지 검증한다: 초대 발송 → 실제 메일에서 ALTON 자체
// 토큰 링크 추출 → 수락(계정 생성) → /set-password → 로그인 완료.

test("관리자가 보호자를 초대하면 실제 메일 링크로 계정을 만들고 로그인까지 완료된다", async ({
  page,
}) => {
  const email = `e2e-parent-${Date.now()}@example.com`;
  const name = "E2E 신규보호자";

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=users");
  await expect(page.getByText("학부모", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "+ 초대" }).first().click();
  await page.getByPlaceholder("이름").fill(name);
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByRole("button", { name: "초대 보내기" }).click();
  await expect(page.getByText("초대 이메일이 발송되었습니다")).toBeVisible();

  const mail = await findLatestEmailTo(email, "계정 초대");
  const acceptUrl = extractInviteAcceptUrl(mail.html);

  await page.goto(acceptUrl);
  await expect(page).toHaveURL(/\/set-password/);

  await page.getByLabel("새 비밀번호", { exact: true }).fill(DEV_PASSWORD);
  await page.getByLabel("새 비밀번호 확인").fill(DEV_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "비밀번호 설정하고 계속하기" }).click();

  await expect(page).toHaveURL(/\/parent/);
});

test("같은 초대 링크를 두 번 방문해도(중복 클릭) 에러 없이 같은 결과로 처리된다", async ({
  page,
}) => {
  const email = `e2e-idempotent-${Date.now()}@example.com`;

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=users");
  await page.getByRole("button", { name: "+ 초대" }).first().click();
  await page.getByPlaceholder("이름").fill("E2E 멱등테스트");
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByRole("button", { name: "초대 보내기" }).click();
  await expect(page.getByText("초대 이메일이 발송되었습니다")).toBeVisible();

  const mail = await findLatestEmailTo(email, "계정 초대");
  const acceptUrl = extractInviteAcceptUrl(mail.html);

  await page.goto(acceptUrl);
  await expect(page).toHaveURL(/\/set-password/);

  // 같은 링크 재방문 — 계정이 이미 생성돼 있어도(finalize 멱등) 여전히
  // /set-password로 정상 도착해야 한다(에러 페이지로 새지 않음).
  await page.goto(acceptUrl);
  await expect(page).toHaveURL(/\/set-password/);
});

// R2 Task 9 — 보호자가 자기 화면에서 자녀를 추가로 초대하는 흐름(§4.19).
// 서버 액션(inviteChild)만 있고 화면이 없던 부분에 /parent?tab=family를
// 새로 만들었다 — 실제 로그인한 보호자로 폼을 채워 실제 메일까지 확인한다.
// 새로 finalize된 계정은 role과 무관하게 항상 status='pending'이라
// /account-pending으로 간다(선생님 프로비저닝과 동일한 패턴).
test("보호자가 자녀를 추가로 초대하면 실제 메일 링크로 계정을 만들고 로그인까지 완료된다", async ({
  page,
}) => {
  const email = `e2e-child-${Date.now()}@example.com`;
  const name = "E2E 추가자녀";

  await loginAs(page, ACCOUNTS.parent);
  await page.goto("/parent?tab=family");
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "초대 보내기" }).click();
  await expect(page.getByText("초대 이메일이 발송되었습니다")).toBeVisible();

  const mail = await findLatestEmailTo(email, "계정 초대");
  const acceptUrl = extractInviteAcceptUrl(mail.html);

  await page.goto(acceptUrl);
  await expect(page).toHaveURL(/\/set-password/);

  await page.getByLabel("새 비밀번호", { exact: true }).fill(DEV_PASSWORD);
  await page.getByLabel("새 비밀번호 확인").fill(DEV_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "비밀번호 설정하고 계속하기" }).click();

  await expect(page).toHaveURL(/\/account-pending/);
});

// R2 Task 9 — 같은 이메일로 pending 초대가 있는 상태에서 다시 초대를 시도하면
// account_invites_pending_unique 유니크 인덱스 위반 같은 내부 구현 오류가
// 아니라 안내 메시지가 화면에 보여야 한다(2026-09-01 create_account_invite()에
// 사전 확인 추가).
test("같은 이메일로 두 번째 초대를 시도하면 원본 DB 오류가 아니라 안내 메시지가 보인다", async ({
  page,
}) => {
  const email = `e2e-dup-${Date.now()}@example.com`;

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=users");
  await page.getByRole("button", { name: "+ 초대" }).first().click();
  await page.getByPlaceholder("이름").fill("E2E 중복테스트");
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByRole("button", { name: "초대 보내기" }).click();
  await expect(page.getByText("초대 이메일이 발송되었습니다")).toBeVisible();

  await page.getByRole("button", { name: "+ 초대" }).first().click();
  await page.getByPlaceholder("이름").fill("E2E 중복테스트 2차");
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByRole("button", { name: "초대 보내기" }).click();

  await expect(page.getByText("이미 처리 대기 중인 초대가 있습니다")).toBeVisible();
  await expect(page.getByText(/duplicate key value|constraint/i)).toHaveCount(0);
});

test("철회된 초대는 실제 브라우저에서 수락 링크를 방문해도 계정을 만들지 않고 로그인 화면으로 돌려보낸다", async ({
  page,
}) => {
  const email = `e2e-revoked-${Date.now()}@example.com`;

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=users");
  await page.getByRole("button", { name: "+ 초대" }).first().click();
  await page.getByPlaceholder("이름").fill("E2E 철회테스트");
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByRole("button", { name: "초대 보내기" }).click();
  await expect(page.getByText("초대 이메일이 발송되었습니다")).toBeVisible();

  const mail = await findLatestEmailTo(email, "계정 초대");
  const acceptUrl = extractInviteAcceptUrl(mail.html);

  revokeInviteByEmail(email);

  await page.goto(acceptUrl);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/철회된 초대입니다/)).toBeVisible();
});
