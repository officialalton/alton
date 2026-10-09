import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, loginAs } from "./helpers";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

// 2026-09-29 갱신 — 초대 "발송 화면"은 정책상 제거됐다.
//  - 관리자 Users 탭의 "+ 초대" 폼(InviteForm)은 개인 이메일 초대가 Workspace
//    프로비저닝/온보딩 흐름으로 대체되면서 삭제됨(14546036).
//  - 보호자 "자녀 추가"(/parent?tab=family) 초대 폼은 2026-09-06 정책 변경("상담 전에
//    보호자가 직접 학생 초대를 보낼 수 없다")으로 비활성화됐고 지금은 화면에 연결돼
//    있지도 않다.
// 서버 쪽 초대(create_account_invite RPC)와 수락 라우트(/api/invite/accept →
// /set-password)는 그대로 살아 있으므로, 이 스펙은 관리자가 호출하는 것과 같은
// RPC로 초대를 만든 뒤 "링크 방문 → 계정 생성 → 로그인" 브라우저 경로와 중복/철회
// 규칙을 계속 검증한다(메일 본문 파싱은 발송 UI가 없어 제외 — 링크는 RPC가 돌려주는
// 토큰으로 조립).

function psqlAsAdmin(sql: string): string {
  return execFileSync(
    "psql",
    [
      DB_URL,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-t",
      "-A",
      "-c",
      `set role authenticated; select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false); ${sql} reset role;`,
    ],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

// 관리자 세션으로 create_account_invite()를 호출해 "이름/이메일 → 초대 토큰"을 만든다
// (예전 InviteForm→inviteGuardian 서버 액션이 하던 것과 같은 RPC, 부모 초대는
// household 없이 신규 가족 생성).
function createParentInvite(email: string, name: string): string {
  const out = psqlAsAdmin(
    `select raw_token from create_account_invite('${email}', '${name}', 'parent', null);`
  );
  // 출력에는 set_config 결과 줄도 섞여 있다 — 토큰은 create_account_invite 결과인 마지막 줄.
  const token = out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).pop();
  if (!token) throw new Error(`초대 토큰을 받지 못했습니다: ${out}`);
  return token;
}

function acceptPath(token: string): string {
  return `/api/invite/accept?token=${encodeURIComponent(token)}`;
}

function revokeInviteByEmail(email: string) {
  psqlAsAdmin(
    `select revoke_account_invite(id) from account_invites where email_normalized = lower('${email}') and status = 'pending';`
  );
}

// R2 Task 4 — 초대 수락 전체 흐름을 실제 브라우저로 끝까지 검증한다: 초대 생성 →
// ALTON 자체 토큰 링크 방문(수락, 계정 생성) → /set-password → 로그인 완료.
test("초대 링크로 계정을 만들고 비밀번호를 설정하면 보호자 포털에 로그인된다", async ({ page }) => {
  const email = `e2e-parent-${Date.now()}@example.com`;
  const token = createParentInvite(email, "E2E 신규보호자");

  await page.goto(acceptPath(token));
  await expect(page).toHaveURL(/\/set-password/);

  await page.getByLabel("New password", { exact: true }).fill(DEV_PASSWORD);
  await page.getByLabel("Confirm new password").fill(DEV_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Set password and continue" }).click();

  await expect(page).toHaveURL(/\/parent/);
});

test("같은 초대 링크를 두 번 방문해도(중복 클릭) 에러 없이 같은 결과로 처리된다", async ({ page }) => {
  const email = `e2e-idempotent-${Date.now()}@example.com`;
  const token = createParentInvite(email, "E2E 멱등테스트");

  await page.goto(acceptPath(token));
  await expect(page).toHaveURL(/\/set-password/);

  // 같은 링크 재방문 — 계정이 이미 생성돼 있어도(finalize 멱등) 여전히
  // /set-password로 정상 도착해야 한다(에러 페이지로 새지 않음).
  await page.goto(acceptPath(token));
  await expect(page).toHaveURL(/\/set-password/);
});

// 같은 이메일로 pending 초대가 있는 상태에서 다시 초대하면 account_invites_pending_unique
// 유니크 인덱스 위반 같은 내부 구현 오류가 아니라 안내 메시지가 나와야 한다
// (2026-09-01 create_account_invite()에 사전 확인 추가). 발송 화면이 없어 RPC 오류
// 메시지(서버 액션이 그대로 사용자에게 전달하던 문구)로 검증한다.
test("같은 이메일로 두 번째 초대를 시도하면 원본 DB 오류가 아니라 안내 메시지가 나온다", async () => {
  const email = `e2e-dup-${Date.now()}@example.com`;
  createParentInvite(email, "E2E 중복테스트");

  let message = "";
  try {
    createParentInvite(email, "E2E 중복테스트 2차");
  } catch (e) {
    message = String((e as { stderr?: unknown }).stderr ?? e);
  }
  expect(message).toContain("이미 처리 대기 중인 초대가 있습니다");
  expect(message).not.toMatch(/duplicate key value|constraint/i);
});

test("철회된 초대는 실제 브라우저에서 수락 링크를 방문해도 계정을 만들지 않고 로그인 화면으로 돌려보낸다", async ({
  page,
}) => {
  const email = `e2e-revoked-${Date.now()}@example.com`;
  const token = createParentInvite(email, "E2E 철회테스트");

  revokeInviteByEmail(email);

  await page.goto(acceptPath(token));
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/This invitation was withdrawn/)).toBeVisible();
});

// 정책 가드: 초대 발송 UI가 다시 열리지 않았는지(관리자 Users 탭의 "+ 초대", 보호자
// 화면의 자녀 초대 폼) 확인한다. 자녀 추가는 상담 신청 → 관리자 온보딩 경로로만 가능.
test("관리자 Users 탭과 보호자 화면에는 초대 발송 UI가 없다", async ({ page }) => {
  test.setTimeout(60000); // 두 역할이 각자 로그인하고 dev 서버가 첫 컴파일을 할 수 있다.
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=users");
  await expect(page.getByText("학부모", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "+ 초대" })).toHaveCount(0);

  const parentPage = await page.context().browser()!.newContext().then((c) => c.newPage());
  await loginAs(parentPage, ACCOUNTS.parent);
  await parentPage.goto("/parent?tab=family");
  await expect(parentPage.getByRole("button", { name: "초대 보내기" })).toHaveCount(0);
  await parentPage.context().close();
});
