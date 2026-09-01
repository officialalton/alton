import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, loginAs } from "./helpers";

// R2 §5.7 계정 수명주기 — 실제 브라우저로 검증한다(단위 테스트는 게이트
// 로직 자체만 확인하지, 로그인 폼 제출부터 리다이렉트까지 이어지는 실제
// 흐름은 확인하지 못한다).
//
// 상태 전환은 transition_account_status()를 직접 psql로 호출해 만든다 —
// 이건 앱의 setTeacherStatus() 서버 액션이 내부적으로 호출하는 것과 정확히
// 같은 함수다(다른 우회 경로가 아니라 정상 경로를 그대로 재현).
// request.jwt.claim.sub를 관리자 프로필 id로 설정해 is_admin() 내부 검사를
// 실제 관리자 세션과 동일하게 통과시킨다.
//
// 각 테스트는 실행 순서에 의존하지 않도록 시작 시점에 자기 상태를 직접
// 세팅한다(이전 테스트가 실패해도 다음 테스트가 영향받지 않는다).

const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 선생님(ACCOUNTS.teacher)
const PARENT_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // 김민지 학부모(ACCOUNTS.parent)
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

// closed는 §5.7상 종착 상태라 transition_account_status()만으로는 임의
// 상태에서 곧장 도달/복귀할 수 없다(허용된 전이만 통과) — 테스트 세팅/정리
// 전용으로 트리거 우회 플래그를 직접 켜고(superuser 권한) status를 원하는
// 값으로 강제한다. 실제 앱/관리자 경로에서는 이 방법을 쓸 수 없다(권한도
// 없고, 이 파일에서만 superuser로 접속하기 때문).
function forceSetTeacherStatus(status: string) {
  const sql = `
    select set_config('app.bypass_status_protect', 'true', true);
    update teachers set status = '${status}' where id = '${TEACHER_ID}';
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function forceSetParentStatus(status: string) {
  const sql = `
    select set_config('app.bypass_status_protect', 'true', true);
    update parents set status = '${status}' where id = '${PARENT_ID}';
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function transitionParentStatus(newStatus: string, reason: string) {
  const sql = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select transition_account_status('${PARENT_ID}'::uuid, '${newStatus}', '${reason}');
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

// 정상 경로 자체(허용된 전이 검증 + 감사 이력)를 실제로 exercise하고 싶을
// 때만 이걸 쓴다 — 테스트 사전 세팅에는 forceSetTeacherStatus를 쓴다.
function transitionTeacherStatus(newStatus: string, reason: string) {
  const sql = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select transition_account_status('${TEACHER_ID}'::uuid, '${newStatus}', '${reason}');
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

test.describe("R2 계정 상태 전환 — 실제 브라우저 로그인 흐름", () => {
  test.afterAll(() => {
    // 다른 e2e 스펙(auth-roles.spec.ts)이 이 선생님/학부모 계정이 active라고
    // 가정하므로, 이 스펙이 끝나면 반드시 원상복구한다.
    forceSetTeacherStatus("active");
    forceSetParentStatus("active");
  });

  test("suspended 계정은 로그인해도 /teacher가 아니라 /account-suspended로 간다", async ({
    page,
  }) => {
    forceSetTeacherStatus("suspended");

    await page.goto("/login");
    await page.getByLabel("이메일").fill(ACCOUNTS.teacher);
    await page.getByLabel("비밀번호").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "로그인", exact: true }).click();

    await expect(page).toHaveURL(/\/account-suspended/);
    await expect(
      page.getByRole("heading", { name: "계정이 일시정지되었습니다" })
    ).toBeVisible();
  });

  test("suspended 계정으로 로그인된 세션에서 포털 페이지로 직접 이동해도 계속 차단된다", async ({
    page,
  }) => {
    forceSetTeacherStatus("suspended");

    await page.goto("/login");
    await page.getByLabel("이메일").fill(ACCOUNTS.teacher);
    await page.getByLabel("비밀번호").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/account-suspended/);

    // 세션은 유지된 채(suspended는 로그아웃시키지 않는다) 다른 포털 경로로
    // 직접 이동을 시도해도 requireUser()가 다시 막아야 한다.
    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/account-suspended/);
  });

  test("관리자가 재활성화하면 같은 계정으로 다시 정상 로그인된다", async ({ page }) => {
    forceSetTeacherStatus("suspended");
    // 여기서는 정상 경로(transition_account_status())로 재활성화해
    // "suspended → active" 전이 자체가 실제로 허용되는지도 함께 확인한다.
    transitionTeacherStatus("active", "e2e: 재활성화 테스트");

    await loginAs(page, ACCOUNTS.teacher);
    await expect(page).toHaveURL(/\/teacher/);
    await expect(page.getByText("박서연 선생님", { exact: false }).first()).toBeVisible();
  });

  test("closure_pending/closed 계정은 로그인 시도 시 강제 로그아웃되어 /login으로 돌아간다", async ({
    page,
  }) => {
    forceSetTeacherStatus("closed");

    await page.goto("/login");
    await page.getByLabel("이메일").fill(ACCOUNTS.teacher);
    await page.getByLabel("비밀번호").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "로그인", exact: true }).click();

    // resolveAccountDestination()이 supabase.auth.signOut()을 호출한 뒤
    // /login?error=...로 보낸다 — /teacher나 /account-suspended가 아니라
    // 로그인 화면 자체로 돌아와야 한다.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/계정이 폐쇄되어 로그인할 수 없습니다/)).toBeVisible();

    // 세션이 실제로 로그아웃됐는지: 같은 페이지에서 보호된 경로로 이동하면
    // /login으로 다시 돌아와야 한다(세션이 남아있다면 /account-suspended
    // 등으로 갔을 것이다).
    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/login/);
  });

  // (2026-08-30 R2 Task 3) 완료 기준 6 — parents.status는 households/household_members
  // cutover와 무관하게 계속 transition_account_status()의 정상 대상이어야 한다.
  test("학부모(parents.status) 정지→관리자 재활성화도 선생님과 동일하게 동작한다", async ({
    page,
  }) => {
    forceSetParentStatus("suspended");

    await page.goto("/login");
    await page.getByLabel("이메일").fill(ACCOUNTS.parent);
    await page.getByLabel("비밀번호").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/account-suspended/);

    transitionParentStatus("active", "e2e: 학부모 재활성화 테스트");

    await loginAs(page, ACCOUNTS.parent);
    await expect(page).toHaveURL(/\/parent/);
  });

  // (2026-09-05 R2 Task 7) 이 테스트는 역할과 무관한 "허용된 전이 표"
  // 자체를 검증하는 것이 목적이라 parent로 실행한다 — teacher의
  // pending→active는 R2 Task 7부터 Workspace 프로비저닝 7개 선행조건이
  // 추가로 걸려서(get_teacher_activation_checklist()), 그 조건과 무관한
  // 이 제네릭 테스트에서 teacher를 쓰면 의도와 다른 이유로 막힌다.
  test("정상 상태 전이(pending→active, active↔suspended, active→closure_pending→closed)는 허용되고 그 외는 거부된다", async () => {
    forceSetParentStatus("pending");
    transitionParentStatus("active", "온보딩 승인");
    transitionParentStatus("suspended", "일시정지");
    transitionParentStatus("active", "재활성화");
    transitionParentStatus("closure_pending", "탈퇴 시작");
    transitionParentStatus("closed", "탈퇴 완료");

    let rejected = false;
    try {
      transitionParentStatus("active", "closed에서는 되돌릴 수 없어야 함");
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
