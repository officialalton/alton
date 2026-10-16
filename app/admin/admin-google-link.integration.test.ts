import { execFileSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// 관리자 Google 로그인 버그 수정(app/auth/admin-google-callback,
// app/auth/admin-google-link-callback, app/admin/google-link-actions.ts)의
// DB 계층 검증. 이 저장소는 SECURITY DEFINER 함수/제약을 직접 검증할 때
// mocked Supabase 클라이언트가 아니라 psql shell-out 패턴을 쓴다
// (app/admin/trial-sessions-guardian-consent.integration.test.ts,
// e2e/account-merge.spec.ts 참고).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // 기존 admin 프로필
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 기존 teacher 프로필
const SECOND_ADMIN_ID = "f2222222-0000-0000-0000-000000000009";
const SECOND_ADMIN_EMAIL = "second-admin-e2e@example.com";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail but it succeeded");
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

function asUser(id: string, sql: string): string {
  return `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${id}', false);
    ${sql}
    reset role;
  `;
}

// asUser()는 set role/set_config/reset role 출력까지 같은 -t -A 스트림에
// 섞어 낸다 — 실제 쿼리 결과만 마지막 boolean 값 줄에서 골라낸다.
function lastBooleanLine(output: string): string {
  const lines = output.trim().split("\n").filter((l) => l === "t" || l === "f");
  return lines[lines.length - 1];
}

function ensureSecondAdmin() {
  psql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', '${SECOND_ADMIN_ID}', 'authenticated', 'authenticated',
      '${SECOND_ADMIN_EMAIL}', crypt('irrelevant', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
    ) on conflict (id) do nothing;
    insert into profiles (id, role, name) values ('${SECOND_ADMIN_ID}', 'admin', 'E2E 두번째관리자')
    on conflict (id) do nothing;
  `);
}

function resetState() {
  psql(`
    delete from admin_google_identities where profile_id in ('${ADMIN_ID}', '${SECOND_ADMIN_ID}', '${TEACHER_ID}');
  `);
}

describe("admin_google_identities / link_admin_google_identity (SECURITY DEFINER)", () => {
  beforeEach(() => {
    ensureSecondAdmin();
    resetState();
  });

  afterAll(() => {
    resetState();
  });

  it("관리자 본인 세션에서 호출하면 자기 profile_id에 연결된다", () => {
    psql(
      asUser(
        ADMIN_ID,
        `select link_admin_google_identity('google-uid-admin-main', 'admin-main@example.com');`
      )
    );
    const row = psql(
      `select google_user_id, google_email from admin_google_identities where profile_id = '${ADMIN_ID}';`
    ).trim();
    expect(row).toBe("google-uid-admin-main|admin-main@example.com");
  });

  it("관리자가 아닌 계정(선생님)이 호출하면 거부된다 — 연결 레코드가 생기지 않는다", () => {
    const stderr = psqlExpectError(
      asUser(TEACHER_ID, `select link_admin_google_identity('google-uid-teacher-x', 'teacher-x@example.com');`)
    );
    expect(stderr).toContain("관리자만 Google 계정을 연결할 수 있습니다");
    const count = psql(
      `select count(*) from admin_google_identities where profile_id = '${TEACHER_ID}';`
    ).trim();
    expect(count).toBe("0");
  });

  it("이미 다른 관리자 계정에 연결된 Google 계정은 재사용할 수 없다(중복 연결 방지)", () => {
    psql(
      asUser(ADMIN_ID, `select link_admin_google_identity('google-uid-shared', 'shared@example.com');`)
    );

    const stderr = psqlExpectError(
      asUser(
        SECOND_ADMIN_ID,
        `select link_admin_google_identity('google-uid-shared', 'shared-attempt@example.com');`
      )
    );
    expect(stderr).toContain("이미 다른 관리자 계정에 연결되어 있습니다");

    const count = psql(
      `select count(*) from admin_google_identities where google_user_id = 'google-uid-shared';`
    ).trim();
    expect(count).toBe("1");
  });

  it("current_user_admin_google_identity_linked()는 본인의 연결 여부만 확인한다(self-only)", () => {
    psql(asUser(ADMIN_ID, `select link_admin_google_identity('google-uid-self-check', 'self-check@example.com');`));

    const ownCheck = lastBooleanLine(
      psql(asUser(ADMIN_ID, `select current_user_admin_google_identity_linked('google-uid-self-check');`))
    );
    expect(ownCheck).toBe("t");

    // 다른 관리자 세션에서 남의 google_user_id로 조회해도 자기 자신의
    // 연결만 보므로 false다(타인의 연결 여부를 알아낼 방법이 없다).
    const otherCheck = lastBooleanLine(
      psql(
        asUser(SECOND_ADMIN_ID, `select current_user_admin_google_identity_linked('google-uid-self-check');`)
      )
    );
    expect(otherCheck).toBe("f");
  });

  it("재연결(같은 관리자가 다시 연결)은 upsert되어 이전 값을 갱신한다", () => {
    psql(asUser(ADMIN_ID, `select link_admin_google_identity('google-uid-v1', 'v1@example.com');`));
    psql(asUser(ADMIN_ID, `select link_admin_google_identity('google-uid-v2', 'v2@example.com');`));

    const row = psql(
      `select google_user_id, google_email from admin_google_identities where profile_id = '${ADMIN_ID}';`
    ).trim();
    expect(row).toBe("google-uid-v2|v2@example.com");
  });
});
