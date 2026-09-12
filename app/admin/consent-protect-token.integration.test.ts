import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 배치 1-1 corrective(20261251000000/20261252000000) — bypass_consent_protect GUC를
// status_transition_tokens 1회용 토큰으로 교체한 뒤의 회귀 테스트. 이 저장소는 DB
// 트리거/함수를 직접 검증할 때 mocked Supabase 클라이언트가 아니라 psql을
// shell-out하는 패턴을 쓴다(trial-sessions-guardian-consent.integration.test.ts 참고).
// 다른 통합 테스트 파일과의 레이스를 피하기 위해 이 파일 전용 학생/보호자를 새로 만든다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    ${sql}
    reset role;
  `);
}

let policyId: string;

function createGuardianAndChild(label: string): { guardianId: string; childId: string; householdId: string } {
  const now = Date.now();
  const guardianId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'consent-token-guardian-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'consent-token-child-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${guardianId}', 'parent', '토큰테스트 보호자(${label})');
    insert into parents (id, status) values ('${guardianId}', 'active');
    insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '토큰테스트 학생(${label})', ((now() at time zone 'utc')::date - interval '10 years')::date);
    insert into students (id, grade, status) values ('${childId}', '5학년', 'pending');
  `);
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(`
    insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${guardianId}', 'guardian', true);
    insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);
  `);
  return { guardianId, childId, householdId };
}

function lastLine(output: string): string {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines[lines.length - 1]?.trim() ?? "";
}

function consentAsGuardian(guardianId: string, childId: string): string {
  const out = asUser(
    guardianId,
    `select consent_as_guardian('${childId}'::uuid, '${policyId}'::uuid, now());`
  );
  return lastLine(out);
}

beforeAll(() => {
  policyId = psql(
    `insert into consent_policy_versions (version, title, content_hash, effective_from, requires_reconsent)
     values ('consent-token-test-${Date.now()}', 'ALTON 개인정보 처리방침 토큰테스트', 'hash-token-test', now() - interval '1 day', true)
     returning id;`
  );
});

afterAll(() => {
  // guardian_consents/privacy_review_tasks는 이제 함수를 통해서만 UPDATE 가능하고
  // DELETE는 항상 금지이므로, 이 파일이 만든 데이터는 정리하지 않고
  // `supabase db reset --local`(CLAUDE.md UAT 관례)에 맡긴다.
});

describe("status_transition_tokens — 권한 잠금(GRANT/REVOKE) 확인", () => {
  it("authenticated/service_role 모두 실제 public.status_transition_tokens에 INSERT/UPDATE/DELETE 권한이 없다", () => {
    const grants = psql(`
      select
        has_table_privilege('authenticated', 'public.status_transition_tokens', 'INSERT'),
        has_table_privilege('authenticated', 'public.status_transition_tokens', 'UPDATE'),
        has_table_privilege('authenticated', 'public.status_transition_tokens', 'DELETE'),
        has_table_privilege('authenticated', 'public.status_transition_tokens', 'SELECT'),
        has_table_privilege('service_role', 'public.status_transition_tokens', 'INSERT'),
        has_table_privilege('service_role', 'public.status_transition_tokens', 'UPDATE'),
        has_table_privilege('service_role', 'public.status_transition_tokens', 'DELETE'),
        has_table_privilege('service_role', 'public.status_transition_tokens', 'SELECT');
    `);
    expect(grants).toBe("f|f|f|f|f|f|f|f");
  });
});

describe("protect_guardian_consent() / revoke_guardian_consent() — status_transition_tokens 1회용 토큰(corrective 회귀)", () => {
  it("① 정상 철회(관리자 경로) — 철회 3필드 UPDATE와 privacy_review_tasks 행 생성이 함께 일어난다", () => {
    const { guardianId, childId } = createGuardianAndChild("admin-path");
    const consentId = consentAsGuardian(guardianId, childId);

    const beforeTaskCount = psql(`select count(*) from privacy_review_tasks where student_id = '${childId}';`);
    expect(beforeTaskCount).toBe("0");

    asUser(ADMIN_ID, `select revoke_guardian_consent('${consentId}'::uuid, '관리자 철회 테스트');`);

    const revoked = psql(
      `select revoked_at is not null, revoked_by, revocation_reason from guardian_consents where id = '${consentId}';`
    );
    expect(revoked.split("|")[0]).toBe("t");
    expect(revoked).toContain(ADMIN_ID);

    const afterTaskCount = psql(`select count(*) from privacy_review_tasks where student_id = '${childId}';`);
    expect(afterTaskCount).toBe("1");
  });

  it("① 정상 철회(본인 보호자 경로) — 철회 3필드 UPDATE와 privacy_review_tasks 행 생성이 함께 일어난다", () => {
    const { guardianId, childId } = createGuardianAndChild("guardian-path");
    const consentId = consentAsGuardian(guardianId, childId);

    asUser(guardianId, `select revoke_guardian_consent('${consentId}'::uuid, '본인 보호자 철회 테스트');`);

    const revoked = psql(`select revoked_at is not null from guardian_consents where id = '${consentId}';`);
    expect(revoked).toBe("t");
    const taskCount = psql(`select count(*) from privacy_review_tasks where student_id = '${childId}';`);
    expect(taskCount).toBe("1");
  });

  it("② 철회 3필드만 노린 직접 UPDATE를 토큰 없이 시도하면 거부된다(방식 a였다면 통과했을 케이스)", () => {
    const { guardianId, childId } = createGuardianAndChild("direct-update-block");
    const consentId = consentAsGuardian(guardianId, childId);

    expect(() =>
      psql(
        `update guardian_consents set revoked_at = now(), revoked_by = '${ADMIN_ID}', revocation_reason = '토큰 없는 직접 UPDATE' where id = '${consentId}';`
      )
    ).toThrow(/revoke_guardian_consent\(\)를 통해서만/);

    const stillActive = psql(`select revoked_at is null from guardian_consents where id = '${consentId}';`);
    expect(stillActive).toBe("t");
    const taskCount = psql(`select count(*) from privacy_review_tasks where student_id = '${childId}';`);
    expect(taskCount).toBe("0");
  });

  it("③ 예전 GUC(app.bypass_consent_protect)를 직접 SET해도 새 설계에는 아무 효과가 없다", () => {
    const { guardianId, childId } = createGuardianAndChild("legacy-guc-noop");
    const consentId = consentAsGuardian(guardianId, childId);

    expect(() =>
      psql(
        `set app.bypass_consent_protect = 'true';
         update guardian_consents set revoked_at = now(), revoked_by = '${ADMIN_ID}', revocation_reason = 'legacy guc' where id = '${consentId}';`
      )
    ).toThrow(/revoke_guardian_consent\(\)를 통해서만/);

    const stillActive = psql(`select revoked_at is null from guardian_consents where id = '${consentId}';`);
    expect(stillActive).toBe("t");
    void childId;
  });

  it("⑤ [corrective] 세션 로컬 temp table로 위조 토큰을 심어도 거부된다(20261255000000 search_path/스키마 한정 수정 검증)", () => {
    // 배치 1 corrective(20261255000000) 이전에는 consume_status_transition_token()과
    // revoke_guardian_consent()가 status_transition_tokens를 스키마 한정 없이
    // 참조하고 search_path = public만 설정했다. PostgreSQL은 search_path 설정과
    // 무관하게 세션의 pg_temp 스키마를 항상 먼저 찾으므로, 호출자가 자기 세션에
    // 동명의 temp table을 만들고 위조 토큰 행을 심으면 그 함수들의 unqualified
    // 참조가 진짜 public.status_transition_tokens 대신 이 temp table로 resolve되어
    // 잠금을 완전히 무력화할 수 있었다. 이 테스트는 그 공격을 그대로 재현하고,
    // 완전 스키마 한정(public.status_transition_tokens) + search_path 고정
    // (public, pg_temp) 수정 이후에는 여전히 거부됨을 확인한다.
    const { guardianId, childId } = createGuardianAndChild("temp-table-attack");
    const consentId = consentAsGuardian(guardianId, childId);

    expect(() =>
      psql(`
        create temp table status_transition_tokens (
          table_name text not null,
          row_id uuid not null,
          action text not null,
          xact_id bigint not null default txid_current(),
          created_at timestamptz not null default now()
        );
        begin;
        insert into status_transition_tokens (table_name, row_id, action, xact_id)
        values ('guardian_consents', '${consentId}', 'revoke_consent', txid_current());
        update guardian_consents
        set revoked_at = now(), revoked_by = '${ADMIN_ID}', revocation_reason = 'temp table 위조 토큰 공격'
        where id = '${consentId}';
        commit;
      `)
    ).toThrow(/revoke_guardian_consent\(\)를 통해서만/);

    const stillActive = psql(`select revoked_at is null from guardian_consents where id = '${consentId}';`);
    expect(stillActive).toBe("t");
    const taskCount = psql(`select count(*) from privacy_review_tasks where student_id = '${childId}';`);
    expect(taskCount).toBe("0");
  });

  it("④ privacy_review_tasks INSERT 실패 시 트랜잭션 전체가 롤백된다(토큰도 철회 UPDATE도 남지 않음)", () => {
    const { guardianId, childId } = createGuardianAndChild("atomicity");
    const consentId = consentAsGuardian(guardianId, childId);

    // privacy_review_tasks INSERT를 강제로 실패시키는 임시 트리거(테스트 종료 시 정리).
    psql(`
      create or replace function force_privacy_review_task_failure_for_test()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced failure for atomicity test';
      end;
      $$;
    `);
    psql(`
      create trigger force_privacy_review_task_failure
        before insert on privacy_review_tasks
        for each row execute function force_privacy_review_task_failure_for_test();
    `);

    try {
      expect(() =>
        asUser(guardianId, `select revoke_guardian_consent('${consentId}'::uuid, '원자성 테스트');`)
      ).toThrow(/forced failure/);

      const stillActive = psql(`select revoked_at is null from guardian_consents where id = '${consentId}';`);
      expect(stillActive).toBe("t");
      const taskCount = psql(`select count(*) from privacy_review_tasks where student_id = '${childId}';`);
      expect(taskCount).toBe("0");
      const tokenCount = psql(
        `select count(*) from status_transition_tokens where table_name = 'guardian_consents' and row_id = '${consentId}';`
      );
      expect(tokenCount).toBe("0");
    } finally {
      psql(`drop trigger if exists force_privacy_review_task_failure on privacy_review_tasks;`);
      psql(`drop function if exists force_privacy_review_task_failure_for_test();`);
    }
  });
});
