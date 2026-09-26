import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

// 2026-09-23 — E2E 전용 fixture(supabase/seed.sql §13)로 이전. 예전에는
// ACCOUNTS.student/parent(지훈/김민지)를 그대로 썼는데, 이 스펙이 학생의
// 생년월일을 13세 미만으로 바꿨다가 되돌리는 식으로 테스트해서 fullyParallel
// 아래서 다른 스펙(auth-roles.spec.ts 등)과 같은 계정 상태를 두고 경합해
// 플레이키했다. 이 학생/학부모는 이 파일에서만 쓴다.
const E2E_STUDENT = "e2e-minor-consent-student@example.com";
const E2E_PARENT = "e2e-minor-consent-parent@example.com";

// 학생/학부모 셸은 계정 메뉴를 먼저 열어야 로그아웃 버튼이 나타난다
// (StudentShell/ParentShell 공통 패턴). 2026-09-23 — "OOO님 ▾" 텍스트는
// md:hidden(모바일 전용) 상단바에만 있고, 데스크톱(Playwright 기본 뷰포트)
// 사이드바 하단의 계정 버튼에는 "▾" 없이 "OOO님"만 있다 — 두 버전 다
// DOM에는 있고 하나만 보이므로 filter({visible:true})로 실제 보이는 쪽만
// 클릭해야 한다(안 그러면 숨은 쪽을 기다리다 타임아웃난다).
async function logoutViaAccountMenu(page: Page) {
  await page
    .getByRole("button", { name: /학생님|학부모님/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  // 로그아웃은 서버 액션(form action)이라 리다이렉트가 비동기로 온다 — 이걸
  // 기다리지 않고 바로 다음 loginAs()의 page.goto("/login")를 호출하면, 그
  // goto가 끝난 직후 지연된 로그아웃 리다이렉트가 다시 도착해 /login에서
  // 또 다른 곳으로 밀어내는 경합이 생겨(이메일 입력창이 영원히 안 나타남)
  // 실제로 재현됐다. 로그아웃이 실제로 /login에 도달할 때까지 여기서 기다린다.
  await page.waitForURL(/\/login/);
}

// R2 Task 6 — 13세 미만 보호자 동의의 전체 흐름을 실제 브라우저로 검증한다.
// 게이트 로직 자체(is_under_13 경계값, RLS 26개 정책 교체, 동의 불변성,
// 재동의, transition_account_status 결합 등)는 이미 psql로 철저히
// 검증했다(supabase/migrations/20260904000000_r2_minor_consent.sql 옆 실행
// 로그 참고) — 여기서는 그 결과가 실제 로그인·포털 흐름에 정확히
// 반영되는지만 확인한다: 미동의 → 보호자 동의 → 학생 이용 → 철회 → 재차단.

const STUDENT_ID = "eeee1111-0000-0000-0000-000000000001"; // E2E 동의테스트 학생(supabase/seed.sql §13)
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

// 2026-09-23 — 부모 포털(ConsentTab.tsx)에는 "동의 철회" 버튼이 UI에 연결돼
// 있지 않다(백엔드 revoke_guardian_consent()/revokeChildConsent 서버 액션은
// 존재하지만 컴포넌트가 import하지 않음 — 제품 오너 확인 결과 UI는 의도적으로
// 그대로 두고 이 테스트만 실제 존재하는 경로로 고치기로 함). 그래서 철회는
// 관리자 권한으로 직접 호출하고, 그 결과가 부모 화면에 정확히 반영되는지만
// 확인한다.
function revokeConsentAsAdmin() {
  const sql = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select revoke_guardian_consent(id, 'e2e 철회 테스트') from guardian_consents
      where student_id = '${STUDENT_ID}' and revoked_at is null;
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function restoreAdultStudent() {
  // 이 fixture는 이 스펙 전용이라 다른 스펙에 영향은 없지만, 반복 실행 시
  // 항상 같은 초기 상태에서 시작하도록 성인(13세 이상)으로 되돌려둔다.
  const sql = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select set_student_date_of_birth('${STUDENT_ID}'::uuid, ((now() at time zone 'utc')::date - interval '20 years')::date);
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

// 세 테스트 모두 같은 fixture 학생/학부모의 동의 상태를 순서대로 이어받는다
// (setup()이 매번 리셋하긴 하지만, DOB/consent 갱신이 fullyParallel 아래
// 동시에 실행되는 다른 test()와 경합하지 않도록 이 describe 내부는 항상
// 순차 실행되게 고정한다 — account-lifecycle.spec.ts 등과 동일한 패턴).
test.describe.configure({ mode: "serial" });

test.describe("R2 Task 6 — 13세 미만 보호자 동의 — 실제 브라우저 흐름", () => {
  test.afterAll(() => {
    restoreAdultStudent();
  });

  test("미동의 상태의 13세 미만 학생은 로그인해도 /consent-pending으로 간다", async ({ page }) => {
    setup();

    await loginAs(page, E2E_STUDENT);
    await expect(page).toHaveURL(/\/consent-pending/);
    await expect(
      page.getByRole("heading", { name: "보호자 동의가 필요합니다" })
    ).toBeVisible();
    await expect(page.getByText("E2E 동의테스트 학부모", { exact: false })).toBeVisible();

    // 이 화면에서 다른 포털 기능(과제/문제풀이/메시지 등)으로 이동을
    // 시도해도 계속 여기로 막혀야 한다.
    await page.goto("/student");
    await expect(page).toHaveURL(/\/consent-pending/);
  });

  test("보호자가 실제 화면에서 동의하면 학생이 정상적으로 서비스를 이용할 수 있다", async ({
    page,
  }) => {
    setup();

    await loginAs(page, E2E_PARENT);
    await page.goto("/parent?tab=consent");
    await expect(page.getByText("동의 필요").first()).toBeVisible();

    const studentCard = page.getByTestId(`consent-card-${STUDENT_ID}`);
    await studentCard
      .getByRole("button", { name: /ALTON 개인정보 처리방침 e2e-v1에 동의/ })
      .click();
    await expect(studentCard.getByText("동의 완료").first()).toBeVisible();

    await logoutViaAccountMenu(page);
    await expect(page).toHaveURL(/\/login/);

    await loginAs(page, E2E_STUDENT);
    await expect(page).toHaveURL(/\/student/);
  });

  test("보호자가 철회하면 학생은 다음 로그인부터 다시 차단된다", async ({ page }) => {
    // 이 테스트만 로그인·로그아웃을 4번 오가서 기본 30s 예산을 넘기기 쉽다.
    test.setTimeout(60000);
    setup();

    await loginAs(page, E2E_PARENT);
    await page.goto("/parent?tab=consent");
    const studentCard = page.getByTestId(`consent-card-${STUDENT_ID}`);
    await studentCard
      .getByRole("button", { name: /ALTON 개인정보 처리방침 e2e-v1에 동의/ })
      .click();
    await expect(studentCard.getByText("동의 완료").first()).toBeVisible();

    // 동의 확인: 학생이 정상 로그인된다.
    await logoutViaAccountMenu(page);
    await loginAs(page, E2E_STUDENT);
    await expect(page).toHaveURL(/\/student/);
    await logoutViaAccountMenu(page);

    // 철회 — 부모 포털에는 이 동작을 트리거할 UI가 없다(ConsentTab.tsx가
    // revokeChildConsent를 아직 연결하지 않음, 제품 오너 확인 결과 의도적으로
    // 보류 중). 관리자 권한으로 직접 철회한 뒤, 그 결과가 부모 화면에
    // 정확히 반영되는지만(읽기 경로) 확인한다.
    revokeConsentAsAdmin();
    await loginAs(page, E2E_PARENT);
    await page.goto("/parent?tab=consent");
    await expect(studentCard.getByText("동의 필요")).toBeVisible();

    // 학생은 다음 로그인부터 다시 /consent-pending으로 막힌다(강제
    // 로그아웃은 아니다 — 이미 로그인된 세션이 있었다면 다음 요청부터).
    await logoutViaAccountMenu(page);
    await loginAs(page, E2E_STUDENT);
    await expect(page).toHaveURL(/\/consent-pending/);
  });
});
