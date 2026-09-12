import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-06 — 실제 버그 재현(matchbox512@snu.ac.kr 상담건, non-prod psql로
// 직접 확인): 계정 병합(app/admin/merge-actions.ts anonymizeMergedAccount())이
// auth.admin.deleteUser()로 원본 Auth 계정을 지우면 auth.users의 이메일은
// 스크럽되지만 auth.identities는 예전 이메일 그대로 좀비로 남는다. 그 결과
// 같은 이메일로 다시 온보딩 링크를 몇 번을 재발급해도(계정 생성) 영원히
// 실패한다. cleanup_orphaned_auth_identities()가 이 좀비를 정리하고 나면
// 같은 이메일로 다시 계정을 만들 수 있어야 한다.
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function simulateAnonymizedMergedGuardian(email: string): string {
  // auth.users에 계정을 만든 뒤, identities를 남겨둔 채로 이메일만 스크럽한다
  // (GoTrue의 실제 관측 동작을 그대로 흉내— non-prod에서 실측한 그대로).
  const userId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(
    `insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
     values (gen_random_uuid(), '${userId}', '${userId}', 'email', jsonb_build_object('sub', '${userId}', 'email', '${email}'), now(), now(), now());`
  );
  // GoTrue soft-delete 스크럽 흉내: auth.users.email만 anonymize, identities는 그대로.
  psql(`update auth.users set email = 'deleted+${userId}@removed.invalid' where id = '${userId}';`);
  return userId;
}

describe("cleanup_orphaned_auth_identities() — matchbox512@snu.ac.kr 상담건 재현", () => {
  it("[수정 전 회귀] find_auth_user_id_by_email()은 좀비 identities를 보지 못해 '신규 보호자'로 오판한다", () => {
    const email = `matchbox512-repro-${Date.now()}@snu.ac.kr`;
    const oldUserId = simulateAnonymizedMergedGuardian(email);

    // find_auth_user_id_by_email()은 auth.users만 보므로 "신규 보호자"로
    // 오판한다 — 실제 코드(lib/trial-onboarding-finalize.ts)가 이 경로를 타서
    // admin.auth.admin.createUser()를 호출하고, GoTrue가 (provider, email)
    // 유니크 제약(애플리케이션 레벨, 로컬 Postgres 스키마에는 없어 여기서는
    // 직접 재현하지 않음 — non-prod 실측으로 확인된 사실)에 걸려 실패한다.
    const existing = psql(`select find_auth_user_id_by_email('${email}');`);
    expect(existing).toBe("");
    // 좀비 identities는 여전히 예전 유저를 가리키며 남아있다 — 이게 근본 원인이다.
    const zombieCount = psql(
      `select count(*) from auth.identities where identity_data->>'email' = '${email}' and user_id = '${oldUserId}';`
    );
    expect(zombieCount).toBe("1");
  });

  it("[수정 후] cleanup_orphaned_auth_identities()가 좀비를 지우면 같은 이메일로 다시 계정을 만들 수 있다", () => {
    const email = `matchbox512-repro2-${Date.now()}@snu.ac.kr`;
    const oldUserId = simulateAnonymizedMergedGuardian(email);

    const cleaned = Number(psql(`select cleanup_orphaned_auth_identities('${email}');`));
    expect(cleaned).toBe(1);

    const remaining = psql(
      `select count(*) from auth.identities where identity_data->>'email' = '${email}' and user_id = '${oldUserId}';`
    );
    expect(remaining).toBe("0");

    // 이제 같은 이메일로 새 계정 생성이 실제로 성공한다(재발급을 아무리 해도
    // 안 되던 것이, 정리 후에는 된다).
    const newUserId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    psql(
      `insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
       values (gen_random_uuid(), '${newUserId}', '${newUserId}', 'email', jsonb_build_object('sub', '${newUserId}', 'email', '${email}'), now(), now(), now());`
    );
    const identityCount = psql(`select count(*) from auth.identities where user_id = '${newUserId}';`);
    expect(identityCount).toBe("1");
  });

  it("정상 계정(스크럽 안 된)의 identities는 절대 건드리지 않는다", () => {
    const email = `active-guardian-${Date.now()}@example.com`;
    const userId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    psql(
      `insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
       values (gen_random_uuid(), '${userId}', '${userId}', 'email', jsonb_build_object('sub', '${userId}', 'email', '${email}'), now(), now(), now());`
    );
    const cleaned = Number(psql(`select cleanup_orphaned_auth_identities('${email}');`));
    expect(cleaned).toBe(0);
    const stillThere = psql(`select count(*) from auth.identities where user_id = '${userId}';`);
    expect(stillThere).toBe("1");
  });
});
