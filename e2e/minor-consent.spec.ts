import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// 학생/학부모 셀은 계정 메뉴("OOO님 ▾")를 먼저 열어야 로그아웃 버튼이
// 나타난다(StudentShell/ParentShell 공통 패턴).
async function logoutViaAccountMenu(page: Page) {
  await page.getByRole("button", { name: /▾/ }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
}

// R2 Task 6 — 13세 미만 보호자 동의의 전체 흐름을 실제 브라우저로 검증한다.
// 게이트 로직 자체(is_under_13 경계값, RLS 26개 정책 교체, 동의 불변성,
// 재동의, transition_account_status 결합 등)는 이미 psql로 철저히
// 검증했다(supabase/migrations/20260904000000_r2_minor_consent.sql 옆 실행
// 로그 참고) — 여기서는 그 결과가 실제 로그인·포털 흐름에 정확히
// 반영되는지만 확인한다: 미동의 → 보호자 동의 → 학생 이용 → 철회 → 재차단.

const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈(ACCOUNTS.student)
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const POLICY_ID = "e2222222-0000-0000-0000-000000000001";

function setup() {
  const sql = `
    insert into consent_policy_versions (id, version, title, content_hash, effective_from, requires_reconsent)
    values ('${POLICY_ID}', 'e2e-v1', 'ALTON 개인정보 처리방침 e2e-v1', 'hash-e2e-v1', now() - interval '1 day', true)
    on conflict (id) do nothing;

    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select set_student_date_of_birth('${STUDENT_ID}'::uuid, ((now() at time zone 'utc')::date - interval '10 years')::date);
    select revoke_guardian_consent(id, 'e2e setup reset') from guardian_consents
      where student_id = '${STUDENT_ID}' and revoked_at is null;
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function restoreAdultStudent() {
  // 다른 e2e 스펙(auth-roles.spec.ts 등)이 지훈을 정상 로그인 가능한
  // 학생으로 가정하므로, 이 스펙이 끝나면 반드시 성인(13세 이상)으로
  // 되돌려 동의 게이트가 더 이상 걸리지 않게 한다.
  const sql = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select set_student_date_of_birth('${STUDENT_ID}'::uuid, ((now() at time zone 'utc')::date - interval '20 years')::date);
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

test.describe("R2 Task 6 — 13세 미만 보호자 동의 — 실제 브라우저 흐름", () => {
  test.afterAll(() => {
    restoreAdultStudent();
  });

  test("미동의 상태의 13세 미만 학생은 로그인해도 /consent-pending으로 간다", async ({ page }) => {
    setup();

    await loginAs(page, ACCOUNTS.student);
    await expect(page).toHaveURL(/\/consent-pending/);
    await expect(
      page.getByRole("heading", { name: "보호자 동의가 필요합니다" })
    ).toBeVisible();
    await expect(page.getByText("김민지", { exact: false })).toBeVisible();

    // 이 화면에서 다른 포털 기능(과제/문제풀이/메시지 등)으로 이동을
    // 시도해도 계속 여기로 막혀야 한다.
    await page.goto("/student");
    await expect(page).toHaveURL(/\/consent-pending/);
  });

  test("보호자가 실제 화면에서 동의하면 학생이 정상적으로 서비스를 이용할 수 있다", async ({
    page,
  }) => {
    setup();

    await loginAs(page, ACCOUNTS.parent);
    await page.goto("/parent?tab=consent");
    await expect(page.getByText("동의 필요").first()).toBeVisible();

    const jihoonCard = page.getByTestId(`consent-card-${STUDENT_ID}`);
    await jihoonCard
      .getByRole("button", { name: /ALTON 개인정보 처리방침 e2e-v1에 동의/ })
      .click();
    await expect(jihoonCard.getByText("동의 완료")).toBeVisible();
    await expect(jihoonCard.getByText("동의 철회")).toBeVisible();

    await logoutViaAccountMenu(page);
    await expect(page).toHaveURL(/\/login/);

    await loginAs(page, ACCOUNTS.student);
    await expect(page).toHaveURL(/\/student/);
  });

  test("보호자가 철회하면 학생은 다음 로그인부터 다시 차단된다", async ({ page }) => {
    setup();

    await loginAs(page, ACCOUNTS.parent);
    await page.goto("/parent?tab=consent");
    const jihoonCard = page.getByTestId(`consent-card-${STUDENT_ID}`);
    await jihoonCard
      .getByRole("button", { name: /ALTON 개인정보 처리방침 e2e-v1에 동의/ })
      .click();
    await expect(jihoonCard.getByText("동의 완료")).toBeVisible();

    // 동의 확인: 학생이 정상 로그인된다.
    await logoutViaAccountMenu(page);
    await loginAs(page, ACCOUNTS.student);
    await expect(page).toHaveURL(/\/student/);
    await logoutViaAccountMenu(page);

    // 보호자가 철회.
    await loginAs(page, ACCOUNTS.parent);
    await page.goto("/parent?tab=consent");
    page.once("dialog", (dialog) => dialog.accept("e2e 철회 테스트"));
    await jihoonCard.getByRole("button", { name: "동의 철회" }).click();
    await expect(jihoonCard.getByText("동의 필요")).toBeVisible();

    // 학생은 다음 로그인부터 다시 /consent-pending으로 막힌다(강제
    // 로그아웃은 아니다 — 이미 로그인된 세션이 있었다면 다음 요청부터).
    await logoutViaAccountMenu(page);
    await loginAs(page, ACCOUNTS.student);
    await expect(page).toHaveURL(/\/consent-pending/);
  });
});
