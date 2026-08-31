import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { DEV_PASSWORD } from "./helpers";

// R2 Task 5 — 계정 병합의 "즉시 로그인 차단"을 실제 브라우저로 확인한다.
// 병합 자체(소유권 재배정·동시성·감사 이력)는 이미 DB 레벨에서 psql로
// 철저히 검증했다(supabase/migrations/20260903010000_r2_account_merge.sql
// 옆 실행 로그 참고) — 여기서는 병합 결과가 실제 로그인 흐름에 반영되는지만
// 확인한다.

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const DUP_EMAIL = "dup-e2e@example.com";
const DUP_ID = "e1111111-0000-0000-0000-000000000001";
const SURVIVOR_ID = "dddddddd-0000-0000-0000-000000000001";

function setupDuplicateTeacher() {
  const sql = `
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', '${DUP_ID}', 'authenticated', 'authenticated',
      '${DUP_EMAIL}', crypt('${DEV_PASSWORD}', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
    )
    on conflict (id) do nothing;
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), '${DUP_ID}', '${DUP_ID}'::uuid, jsonb_build_object('sub', '${DUP_ID}', 'email', '${DUP_EMAIL}'), 'email', now(), now(), now()
    where not exists (select 1 from auth.identities where user_id = '${DUP_ID}'::uuid);
    insert into profiles (id, role, name) values ('${DUP_ID}', 'teacher', 'E2E 중복선생님') on conflict (id) do nothing;
    insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from, created_by)
    values ('${DUP_ID}', 40000, 'KRW', now(), '${ADMIN_ID}')
    on conflict do nothing;
    insert into teachers (id, school, status) values ('${DUP_ID}', 'E2E대학교', 'active') on conflict (id) do nothing;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function mergeIntoSurvivor() {
  const sql = `
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    set role authenticated;
    select merge_accounts('${SURVIVOR_ID}'::uuid, '${DUP_ID}'::uuid, 'E2E 병합 테스트');
    reset role;
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

test("병합된 원본 계정은 실제 로그인 시도 시 강제 로그아웃되어 /login으로 돌아간다", async ({
  page,
}) => {
  setupDuplicateTeacher();
  mergeIntoSurvivor();

  await page.goto("/login");
  await page.getByLabel("이메일").fill(DUP_EMAIL);
  await page.getByLabel("비밀번호").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();

  // resolveAccountDestination()이 closed 상태를 감지해 signOut() 후
  // /login?error=...로 보낸다(R2 Task 2에서 이미 검증된 경로 — 병합이
  // 그 경로를 정확히 태우는지만 여기서 확인).
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/계정이 폐쇄되어 로그인할 수 없습니다/)).toBeVisible();

  await page.goto("/teacher");
  await expect(page).toHaveURL(/\/login/);
});
