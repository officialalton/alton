import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-11(P4-1) — 기존 주 보호자에게 자녀 추가의 DB 레이어 검증.
// 이 경로는 새 RPC를 만들지 않고 직접 생성 경로(create_direct_onboarding_link_multi)
// + 기존 보호자 분기(finalize_trial_onboarding_students, p_new_guardian=false)를
// 그대로 재사용한다. 여기서 확인하는 것:
//  (1) 후보 조회 기준(households.primary_guardian_id)이 공동 보호자를 제외한다
//      — searchPrimaryGuardiansAction이 그대로 실행하는 쿼리 모양을 재현.
//  (2) 자녀 추가가 새 household를 만들지 않고 기존 가구에 자녀만 넣는다.
//  (3) 형제자매(기존 자녀) 행이 전혀 바뀌지 않는다.
//  (4) 같은 자녀로 두 번 finalize해도 가구·멤버가 중복되지 않는다(멱등).
//  (5) 주 보호자가 아닌 보호자로는 finalize 자체가 실패한다(= 후보에서 빼야 하는 이유).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function uniqueEmail(label: string): string {
  return `p4-1-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function createAuthUser(label: string): { id: string; email: string } {
  const email = uniqueEmail(label);
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  return { id, email };
}

// 이미 자녀 1명이 있는 주 보호자 가구를 만든다(= 자녀 추가의 출발 상태).
function createExistingHousehold(label: string): {
  guardianId: string;
  guardianEmail: string;
  householdId: string;
  firstChildId: string;
} {
  const guardian = createAuthUser(`guardian-${label}`);
  const firstChild = createAuthUser(`child1-${label}`);
  psql(`insert into profiles (id, role, name) values ('${guardian.id}', 'parent', '주보호자${label}');`);
  psql(`insert into parents (id) values ('${guardian.id}');`);
  psql(`insert into profiles (id, role, name) values ('${firstChild.id}', 'student', '첫째${label}');`);
  psql(`insert into students (id, status) values ('${firstChild.id}', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardian.id}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${guardian.id}', 'guardian', true), ('${householdId}', '${firstChild.id}', 'child', false);`
  );
  return { guardianId: guardian.id, guardianEmail: guardian.email, householdId, firstChildId: firstChild.id };
}

function createAddChildLink(guardianEmail: string, guardianName: string, childEmail: string): {
  linkId: string;
  linkStudentId: string;
} {
  const linkId = psql(`
    select link_id from create_direct_onboarding_link_multi(
      '${guardianEmail}', '${guardianName}',
      jsonb_build_array(jsonb_build_object('name', '둘째', 'email', '${childEmail}', 'grade', '9학년')),
      '${ADMIN_ID}'::uuid
    );
  `);
  const linkStudentId = psql(`select id from trial_onboarding_link_students where link_id = '${linkId}'::uuid;`);
  return { linkId, linkStudentId };
}

describe("P4-1 자녀 추가 — 주 보호자 후보 조회", () => {
  it("공동 보호자(household_members만 guardian)는 후보에서 제외되고 주 보호자만 남는다", () => {
    const { guardianId, householdId } = createExistingHousehold("cand");
    const coGuardian = createAuthUser("co-guardian");
    psql(`insert into profiles (id, role, name) values ('${coGuardian.id}', 'parent', '공동보호자');`);
    psql(`insert into parents (id) values ('${coGuardian.id}');`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary)
       values ('${householdId}', '${coGuardian.id}', 'guardian', false);`
    );

    // searchPrimaryGuardiansAction이 실행하는 필터와 동일: households.primary_guardian_id.
    const primaryOnly = psql(
      `select primary_guardian_id from households
       where primary_guardian_id in ('${guardianId}', '${coGuardian.id}');`
    )
      .split("\n")
      .filter(Boolean);
    expect(primaryOnly).toEqual([guardianId]);

    // 두 계정 모두 이 가구의 guardian 멤버이긴 하다(= 멤버십 기준으로 찾으면 공동 보호자도 잡힌다).
    const guardianMembers = Number(
      psql(`select count(*) from household_members where household_id = '${householdId}' and role = 'guardian';`)
    );
    expect(guardianMembers).toBe(2);
  });
});

describe("P4-1 자녀 추가 — finalize(기존 보호자 분기)", () => {
  it("새 household를 만들지 않고 기존 가구에 자녀만 추가하며 형제자매 행은 불변이다", () => {
    const { guardianId, guardianEmail, householdId, firstChildId } = createExistingHousehold("add");
    const beforeFirstChild = psql(
      `select household_id, role, is_primary from household_members where profile_id = '${firstChildId}';`
    );

    const secondChild = createAuthUser("child2-add");
    const { linkId, linkStudentId } = createAddChildLink(guardianEmail, `주보호자add`, secondChild.email);

    const result = psql(
      `select household_id, guardian_id, created_count, failed_count from finalize_trial_onboarding_students(
         '${linkId}', false, '${guardianId}', '주보호자add',
         '[{"link_student_id":"${linkStudentId}","child_auth_user_id":"${secondChild.id}"}]'::jsonb
       );`
    );
    const [returnedHouseholdId, , createdCount, failedCount] = result.split("|");
    expect(returnedHouseholdId).toBe(householdId);
    expect(createdCount).toBe("1");
    expect(failedCount).toBe("0");

    // 가구는 여전히 1개.
    expect(psql(`select count(*) from households where primary_guardian_id = '${guardianId}';`)).toBe("1");
    // 자녀 2명 모두 같은 가구.
    const children = psql(
      `select profile_id from household_members where household_id = '${householdId}' and role = 'child' order by profile_id;`
    )
      .split("\n")
      .filter(Boolean)
      .sort();
    expect(children).toEqual([firstChildId, secondChild.id].sort());
    // 형제자매 행은 그대로.
    expect(psql(`select household_id, role, is_primary from household_members where profile_id = '${firstChildId}';`)).toBe(
      beforeFirstChild
    );
    // 새 자녀는 pending 학생 + 체험 동의 대기(자녀 단위로 새로 시작).
    expect(psql(`select status from students where id = '${secondChild.id}';`)).toBe("pending");
    expect(
      psql(`select trial_entitlement_grant_status from trial_onboarding_link_students where id = '${linkStudentId}';`)
    ).toBe("awaiting_consent");
  });

  it("같은 자녀로 다시 finalize해도 가구·멤버가 중복되지 않는다(멱등)", () => {
    const { guardianId, guardianEmail, householdId } = createExistingHousehold("idem");
    const secondChild = createAuthUser("child2-idem");
    const { linkId, linkStudentId } = createAddChildLink(guardianEmail, `주보호자idem`, secondChild.email);
    const call = `select created_count from finalize_trial_onboarding_students(
        '${linkId}', false, '${guardianId}', '주보호자idem',
        '[{"link_student_id":"${linkStudentId}","child_auth_user_id":"${secondChild.id}"}]'::jsonb
      );`;
    expect(psql(call)).toBe("1");
    expect(psql(call)).toBe("1"); // 이미 created인 학생은 건너뛰고 그대로 집계된다

    expect(psql(`select count(*) from households where primary_guardian_id = '${guardianId}';`)).toBe("1");
    expect(
      psql(`select count(*) from household_members where household_id = '${householdId}' and profile_id = '${secondChild.id}';`)
    ).toBe("1");
  });

  it("주 보호자가 아닌 보호자로는 finalize가 실패한다(후보를 주 보호자로 제한하는 이유)", () => {
    const { householdId } = createExistingHousehold("nonprimary");
    const coGuardian = createAuthUser("co-guardian-finalize");
    psql(`insert into profiles (id, role, name) values ('${coGuardian.id}', 'parent', '공동보호자f');`);
    psql(`insert into parents (id) values ('${coGuardian.id}');`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary)
       values ('${householdId}', '${coGuardian.id}', 'guardian', false);`
    );
    const child = createAuthUser("child-nonprimary");
    const { linkId, linkStudentId } = createAddChildLink(coGuardian.email, "공동보호자f", child.email);

    expect(() =>
      psql(
        `select * from finalize_trial_onboarding_students(
           '${linkId}', false, '${coGuardian.id}', '공동보호자f',
           '[{"link_student_id":"${linkStudentId}","child_auth_user_id":"${child.id}"}]'::jsonb
         );`
      )
    ).toThrow(/household를 찾을 수 없습니다/);
  });
});
