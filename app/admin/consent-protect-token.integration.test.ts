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
