import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// M4 후속(2026-09-06) — 재상담: 이미 보호자 Auth 계정이 있는 사람이 새 자녀로
// 다시 체험 온보딩을 시도할 때 find_auth_user_id_by_email()/
// finalize_trial_onboarding_existing_guardian()이 실제로 동작하는지 로컬
// Postgres에 직접 psql로 검증한다. 새 household·새 보호자 profile을 만들지
// 않고 기존 것을 재사용해야 한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

describe("find_auth_user_id_by_email()", () => {
  it("이메일 대소문자·공백과 무관하게 기존 사용자를 찾는다", () => {
    const now = Date.now();
    const email = `existing-guardian-${now}@example.com`;
    const userId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    const found = psql(`select find_auth_user_id_by_email('  ${email.toUpperCase()}  ');`);
    expect(found).toBe(userId);
  });

  it("존재하지 않는 이메일이면 null을 반환한다", () => {
    const result = psql(`select coalesce(find_auth_user_id_by_email('nobody-${Date.now()}@example.com')::text, 'null');`);
    expect(result).toBe("null");
  });
});

describe("finalize_trial_onboarding_existing_guardian() — 재상담: 기존 보호자 계정에 새 자녀 연결", () => {
  function createExistingGuardian(label: string): { guardianId: string; householdId: string } {
    const now = Date.now();
    const guardianId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '테스트 기존 보호자(${label})');`);
    psql(`insert into parents (id) values ('${guardianId}');`);
    const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${guardianId}', 'guardian', true);`
    );
    // 기존 자녀 1명(첫째) — 새로 추가되는 자녀와 섞이면 안 되므로 존재하게 해둔다.
    const existingChildId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-first-child-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    psql(`insert into profiles (id, role, name) values ('${existingChildId}', 'student', '첫째');`);
    psql(`insert into students (id, grade, status) values ('${existingChildId}', '9학년', 'active');`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${existingChildId}', 'child', true);`
    );
    return { guardianId, householdId };
  }

  function createPendingLink(label: string, guardianEmail: string): { linkId: string; consultationId: string } {
    const now = Date.now();
    const prospectContactId = psql(
      `insert into prospect_contacts (full_name, primary_email) values ('${label}', '${guardianEmail}') returning id;`
    );
    const consultationId = psql(
      `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id, trial_intent_confirmed_at)
       values ('homepage', 'completed', 'trial_recommended', '${label}', '${guardianEmail}', now(), now() + interval '30 minutes', '${prospectContactId}', now())
       returning id;`
    );
    const linkId = psql(
      `insert into trial_onboarding_links (consultation_id, prospect_contact_id, guardian_email, guardian_name, student_name, student_grade, student_email, token_hash, expires_at)
       values ('${consultationId}', '${prospectContactId}', '${guardianEmail}', '${label}', '둘째', '7학년', 'second-child-${now}@example.com', 'unused-hash-${now}', now() + interval '72 hours')
       returning id;`
    );
    return { linkId, consultationId };
  }

  it("기존 household를 재사용하고 새 자녀만 추가한다(새 household·보호자 profile 미생성)", () => {
    const { guardianId, householdId } = createExistingGuardian("reuse-household");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianId}';`);
    const { linkId, consultationId } = createPendingLink("재상담테스트", guardianEmail);

    const newChildId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'reuse-second-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );

    const householdCountBefore = psql(`select count(*) from households where primary_guardian_id = '${guardianId}';`);
    expect(householdCountBefore).toBe("1");

    const row = psql(
      `select household_id, guardian_id, child_id from finalize_trial_onboarding_existing_guardian('${linkId}', '${guardianId}', '${newChildId}');`
    );
    const [returnedHouseholdId, returnedGuardianId, returnedChildId] = row.split("|");
    expect(returnedHouseholdId).toBe(householdId);
    expect(returnedGuardianId).toBe(guardianId);
    expect(returnedChildId).toBe(newChildId);

    // 새 household가 또 생기지 않았어야 한다.
    const householdCountAfter = psql(`select count(*) from households where primary_guardian_id = '${guardianId}';`);
    expect(householdCountAfter).toBe("1");

    // 두 자녀 모두(첫째+새로 추가된 둘째) 같은 household에 있어야 한다.
    const childCount = psql(
      `select count(*) from household_members where household_id = '${householdId}' and role = 'child';`
    );
    expect(childCount).toBe("2");

    const linkStatus = psql(`select status from trial_onboarding_links where id = '${linkId}';`);
    expect(linkStatus).toBe("redeemed");

    const consultationChildId = psql(`select child_id from consultations where id = '${consultationId}';`);
    expect(consultationChildId).toBe(newChildId);
  });

  it("이미 redeemed된 링크에 다시 호출하면(재시도) 중복 생성 없이 기존 결과를 그대로 반환한다", () => {
    const { guardianId } = createExistingGuardian("idempotent-retry");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianId}';`);
    const { linkId } = createPendingLink("멱등재시도", guardianEmail);
    const newChildId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'idempotent-second-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );

    psql(`select finalize_trial_onboarding_existing_guardian('${linkId}', '${guardianId}', '${newChildId}');`);
    const memberCountBefore = psql(`select count(*) from household_members where profile_id = '${newChildId}';`);
    expect(memberCountBefore).toBe("1");

    // 같은 파라미터로 재시도(예: 네트워크 재시도) — 다시 만들지 않고 그대로 반환.
    const retryRow = psql(
      `select household_id, guardian_id, child_id from finalize_trial_onboarding_existing_guardian('${linkId}', '${guardianId}', '${newChildId}');`
    );
    expect(retryRow.split("|")[2]).toBe(newChildId);
    const memberCountAfter = psql(`select count(*) from household_members where profile_id = '${newChildId}';`);
    expect(memberCountAfter).toBe("1");
  });

  it("보호자 계정이 아니면(예: 선생님 id) 거부된다", () => {
    const teacherId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'not-a-guardian-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '선생님인데 잘못 넘어옴');`);
    const { linkId } = createPendingLink("잘못된보호자", "not-a-guardian-check@example.com");
    const childId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'wrong-guardian-child-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    expect(() =>
      psql(`select finalize_trial_onboarding_existing_guardian('${linkId}', '${teacherId}', '${childId}');`)
    ).toThrow(/보호자 계정이 아닙니다/);
  });
});
